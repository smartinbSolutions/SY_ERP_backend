const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/apiError");
const createToken = require("../utils/createToken");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const usersModel = require("../models/Settings/users.model");
const rolesModel = require("../models/Settings/role.model");
const customarSchema = require("../models/Accounting/Sales/customarModel");
const sendEmail = require("../utils/sendEmail");
const { OAuth2Client } = require("google-auth-library");
const E_user_Schema = require("../models/ecommerce/E_user_Modal");
const { default: axios } = require("axios");
const thirdPartyAuthSchema = require("../models/ecommerce/thirdPartyAuthModel");
const companyInfoModel = require("../models/Settings/CompanyInfo/companyInfo.model");
const userCompanySettingsModel = require("../models/Settings/user_company_settings.model");
const companyPlanModel = require("../models/Settings/CompanyInfo/companyPlan.model");
const companySubscriptionModel = require("../models/Settings/CompanyInfo/companySubscription.model");

const normalizeCompanyId = (value) => {
  if (!value) return value;

  if (typeof value === "string") {
    return value;
  }

  if (value.companyId) {
    return normalizeCompanyId(value.companyId);
  }

  if (value._id) {
    return String(value._id);
  }

  return value;
};

// @desc      Login
// @route     POST /api/auth/login
// @access    Public
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;
  const companyId = normalizeCompanyId(req.body.companyId);

  if (!mongoose.Types.ObjectId.isValid(companyId)) {
    return next(new ApiError("Invalid companyId", 400));
  }

  const user = await usersModel
    .findOne({
      email,
      "companies.companyId": companyId,
    })
    .select("+password")
    .populate({
      path: "companies.roleId",
      populate: { path: "permissions" },
    });

  if (!user) {
    return next(new ApiError("Incorrect email or company", 401));
  }

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    return next(new ApiError("Incorrect password", 401));
  }

  const selectedCompany = user.companies.find(
    (c) => c.companyId.toString() === companyId,
  );
  if (!selectedCompany || !selectedCompany.roleId) {
    return next(new ApiError("Role not assigned", 403));
  }
  if (!selectedCompany.active) {
    return next(new ApiError("Account is not active", 401));
  }
  const role = selectedCompany.roleId;

  if (!role.channels.includes("dashboard")) {
    return next(new ApiError("No dashboard access", 403));
  }

  const settings = await userCompanySettingsModel
    .findOne({ companyId, userId: user._id })
    .select("selectedQuickActions")
    .lean();

  const userData = user.toObject();
  userData.password = undefined;
  userData.settings = settings || null;
  userData.selectedQuickActions = settings?.selectedQuickActions || [];

  const companyPlan = await companyPlanModel
    .findOne({ companyId: companyId })
    .lean();

  const token = createToken({
    userId: user._id,
    email: user.email,
    roleId: role._id,
    channels: role.channels,
    companyId,
    authSource: "erp",
    companyPlan: companyPlan.features,
  });

  res.status(200).json({
    status: true,
    data: userData,
    role,
    token,
    company: companyId,
    companyPlan,
  });
});

// @desc   make sure the user is logged in sys
exports.protect = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next(new ApiError("Not login", 401));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

    const currentUser = await usersModel.findOne({
      _id: decoded.userId,
      companies: {
        $elemMatch: { companyId: decoded.companyId },
      },
    });

    if (!currentUser) {
      return next(new ApiError("User does not exist", 404));
    }

    req.user = currentUser;
    req.companyId = decoded.companyId;
    req.roleId = decoded.roleId;
    req.channels = decoded.channels;

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return next(new ApiError("Token has expired", 401));
    }

    return next(new ApiError("Not login", 401));
  }
});

exports.checkCompanyEditable = async (req, res, next) => {
  const companyId = normalizeCompanyId(req.companyId || req.body.companyId);

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  if (!mongoose.Types.ObjectId.isValid(companyId)) {
    return next(new ApiError("Invalid companyId", 400));
  }

  const company = await companyInfoModel
    .findById(companyId)
    .select("rollOver")
    .lean();

  if (!company) {
    return next(new ApiError("Company not found", 404));
  }

  if (company.rollOver) {
    return next(
      new ApiError(
        "The company has already been closed and cannot be modified",
        403,
      ),
    );
  }

  next();
};

// @desc      Forgot password
// @route     POST /api/auth/forgotpasswordpos
// @access    Public
exports.forgotPasswordPos = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  // 1) Get user by email
  const { email } = req.body;
  const user = await usersModel.findOne({ email, companyId });
  if (!user) {
    return next(
      new ApiError(`There is no user with this email address ${email}`, 404),
    );
  }

  // 2) Generate random reset code and save it in db
  const resetCode = Math.floor(Math.random() * 1000000 + 1).toString();
  // Encrypt the reset code before saving it in db (Security)
  const hashedResetCode = await bcrypt.hash(resetCode, 10);

  user.passwordResetCode = hashedResetCode;
  //10 min
  user.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  user.resetCodeVerified = false;
  await user.save();

  // 3) Send password reset code via email
  const message = `Forgot your password? Submit this reset password code: ${resetCode}\n If you didn't forget your password, please ignore this email!`;

  try {
    await sendEmail({
      email: user.email,
      subject: "Your Password Reset Code (valid for 10 min)",
      message,
    });

    res.status(200).json({
      status: "Success",
      message: "Reset code sent to your email",
    });
  } catch (err) {
    // If there's an error sending the email, clear the reset code and expiration time
    user.passwordResetCode = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    console.log(err);
    return next(
      new ApiError(
        "There was an error sending the email. Try again later!",
        500,
      ),
    );
  }
});

// @desc      Verify reset password code
// @route     POST /api/auth/verifyresetcodepos
// @access    Public
exports.verifyPasswordResetCodePos = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const { resetCode } = req.body;

  const user = await usersModel.find({
    passwordResetExpires: { $gt: Date.now() },
    companyId,
  });
  if (!user) {
    return next(new ApiError("Reset code is invalid or has expired", 400));
  }
  // 3) Compare the reset code with the hashed code stored in the database
  const isResetCodeValid = await bcrypt.compare(
    resetCode,
    user.passwordResetCode,
  );
  if (!isResetCodeValid) {
    return next(new ApiError("Reset code is invalid or has expired", 400));
  }
  // 4) Mark reset code as verified
  user.resetCodeVerified = true;
  await user.save();

  res.status(200).json({
    status: "Success",
  });
});

// @desc      Reset password
// @route     POST /api/auth/resetpasswordpos
// @access    Public
exports.resetPasswordPos = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  // 1) Get user based on email
  const user = await usersModel.findOne({
    email: req.body.email,
    companyId,
  });
  if (!user) {
    return next(
      new ApiError(
        `There is no user with this email address ${req.body.email}`,
        404,
      ),
    );
  }
  // Check if user verify the reset code
  if (!user.resetCodeVerified) {
    return next(new ApiError("reset code not verified", 400));
  }
  const hashedResetCode = await bcrypt.hash(req.body.newPassword, 10);

  // 2) Update user password & Hide passwordResetCode & passwordResetExpires from the result
  user.password = hashedResetCode;
  user.passwordResetCode = undefined;
  user.passwordResetExpires = undefined;
  user.resetCodeVerified = undefined;
  await user.save();

  // 3) If everything ok, send token to client
  const token = createToken(user);

  res.status(200).json({ user: user, token });
});

// @desc      Signup
// @route     POST /api/auth/signup
// @access    Public
exports.signup = asyncHandler(async (req, res, next) => {
  const dbName = req.query.databaseName;
  const db = mongoose.connection.useDb(dbName);
  const UserModel = db.model("Users", E_user_Schema);

  const hashedResetCode = await bcrypt.hash(req.body.password, 10);
  const user = await UserModel.create({
    name: req.body.name,
    slug: req.body.slug,
    email: req.body.email,
    phone: req.body.phone,
    password: hashedResetCode,
  });

  const token = createToken(user);

  res.status(201).json({ data: user, token });
});

const client = new OAuth2Client(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  "https://store.noontek.com",
);

// Function to verify Google ID token
async function verifyGoogleToken(token) {
  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: process.env.CLIENT_ID,
  });
  return ticket.getPayload();
}

exports.googleSignin = asyncHandler(async (req, res, next) => {
  const dbName = req.query.databaseName;
  const db = mongoose.connection.useDb(dbName);
  const UserModel = db.model("Customer", customarSchema);

  const { name, email } = req.body;
  try {
    const user = await UserModel.findOne({ email });
    if (user) {
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET_KEY);
      const { password, ...rest } = user._doc;
      res
        .status(200)
        .cookie("access_token", token, {
          httpOnly: true,
        })
        .json(rest);
    } else {
      const generatedPassword =
        Math.round().toString(36).slice(-8) +
        Math.round().toString(36).slice(-8);

      const hashePassword = bcrypt.hashSync(generatedPassword, 10);

      const newUser = new UserModel({
        name: name.toLowerCase().Math.round().toString(9).slice(-4),
        email,
        password: hashePassword,
      });
      await newUser.save();
      const token = createToken(user);
      const { password, ...rest } = newUser._doc;

      res
        .status(200)
        .cookie("access_token", token, { httpOnly: true })
        .json(rest);
    }
  } catch (error) {
    console.error("Error during Google Sign-In:", error);
    next(new Error("Google Sign-In failed"));
  }
});
// @desc    Login
// @route   GET /api/v1/auth/login
// @access  Public
exports.EcommerceLogin = asyncHandler(async (req, res, next) => {
  const dbName = req.query.databaseName;
  const db = mongoose.connection.useDb(dbName);
  const UserModel = db.model("Users", E_user_Schema);

  const user = await UserModel.findOne({ email: req.body.email });

  if (!user || !(await bcrypt.compare(req.body.password, user.password))) {
    return next(new ApiError("Incorrect email or password", 401));
  }
  // 3) generate token
  const token = createToken(user);
  // console.log(token)
  // Delete password from response
  delete user._doc.password;
  // 4) send response to client side
  res.status(200).json({ data: user, token });
});

// @desc   make sure the user is logged in
exports.ecommerceProtect = asyncHandler(async (req, res, next) => {
  const dbName = req.query.databaseName;
  const db = mongoose.connection.useDb(dbName);
  const UserModel = db.model("Users", E_user_Schema);

  let token;
  let isAnonymous = false;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.headers["x-anonymous-token"]) {
    token = req.headers["x-anonymous-token"];
    isAnonymous = true;
  }

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    const currentUser = await UserModel.findById(decoded.userId);
    if (!currentUser) {
      req.user = null;
    } else {
      if (currentUser.passwordChangedAt) {
        const passChangedTimestamp = parseInt(
          currentUser.passwordChangedAt.getTime() / 1000,
          10,
        );
        if (passChangedTimestamp > decoded.iat) {
          req.user = null;
        }
      }
      req.user = currentUser;
    }
  } catch (error) {
    req.user = null;
  }

  next();
});

// @desc      Request password reset
// @route     POST /api/auth/forgotPassword
// @access    Public
exports.forgotPassword = asyncHandler(async (req, res, next) => {
  const dbName = req.query.databaseName;
  const db = mongoose.connection.useDb(dbName);
  const UserModel = db.model("Users", E_user_Schema);

  // 1) Get user by email
  const { email } = req.body;
  const user = await UserModel.findOne({ email });
  if (!user) {
    return next(
      new ApiError(`There is no user with this email address ${email}`, 404),
    );
  }

  // 2) Generate a reset token
  bcrypt.genSalt(10, (err, salt) => {
    if (err) {
      return next(new ApiError("Error generating reset token", 500));
    }
    bcrypt.hash(email, salt, async (err, hashedEmail) => {
      if (err) {
        return next(new ApiError("Error generating reset token", 500));
      }

      // Encode the hashed token to Base64 URL-safe format
      let resetToken = Buffer.from(hashedEmail).toString("base64");
      resetToken = resetToken
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      // Save the hashed token to the database
      user.passwordResetToken = resetToken;
      // Token expires in 10 minutes
      user.passwordResetExpires = Date.now() + 10 * 60 * 1000;
      await user.save();
      // 3) Send password reset email with the link containing the token
      const resetURL = `${process.env.STORE_BASE_URL}/resetPassword/${resetToken}`;
      const message = `Forgot your password? Click on the link below to reset your password:\n${resetURL}\nIf you didn't ask for password rest, please ignore this email!`;
      try {
        await sendEmail({
          email: user.email,
          subject: "Your Password Reset Link (valid for 10 min)",
          message,
        });

        res.status(200).json({
          status: "Success",
          message: "Reset link sent to your email",
          token: resetToken,
        });
      } catch (err) {
        console.error(err);
        return next(
          new ApiError(
            "There was an error sending the email. Try again later!",
            500,
          ),
        );
      }
    });
  });
});

// @desc      Verify reset password code
// @route     POST /api/auth/verifyResetCode
// @access    Public
exports.verifyPasswordResetCode = asyncHandler(async (req, res, next) => {
  const dbName = req.query.databaseName;
  const db = mongoose.connection.useDb(dbName);
  const UserModel = db.model("Users", E_user_Schema);

  // 1) Get user based on reset code
  const { resetCode } = req.body; // Assuming resetCode is a string

  // 2) Get user from database
  const user = await UserModel.findOne({
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    return next(new ApiError("Reset code is invalid or has expired", 400));
  }

  // 3) Compare the reset code with the hashed code stored in the database
  const isResetCodeValid = await bcrypt.compare(
    resetCode,
    user.passwordResetCode,
  );

  if (!isResetCodeValid) {
    return next(new ApiError("Reset code is invalid or has expired", 400));
  }

  // 4) Mark reset code as verified
  user.resetCodeVerified = true;
  await user.save();

  res.status(200).json({
    status: "Success",
  });
});

// @desc      Reset password
// @route     POST /api/auth/resetPassword
// @access    Public
exports.resetPassword = asyncHandler(async (req, res, next) => {
  const dbName = req.query.databaseName;
  const db = mongoose.connection.useDb(dbName);
  const UserModel = db.model("Users", E_user_Schema);

  // Get the reset token from the request parameters
  const resetToken = req.query.token;

  // Find a user with the matching reset token and valid expiration time
  const user = await UserModel.findOne({
    passwordResetToken: resetToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    return next(new ApiError("Reset token is invalid or has expired", 400));
  }
  const newPassword = req.body.newPassword;

  if (!newPassword) {
    return next(new ApiError("New password is required", 400));
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  user.password = hashedPassword;

  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  await user.save();

  res.status(200).json({
    status: "Success",
    message: "Password reset successful",
  });
});

exports.googleLogin = asyncHandler(async (req, res, next) => {
  const dbName = req.query.databaseName;
  const db = mongoose.connection.useDb(dbName);
  const UserModel = db.model("Users", E_user_Schema);
  const thirdPartyModel = db.model("ThirdPartyAuth", thirdPartyAuthSchema);
  const { googleClientID, googleClientSecret, redirectUri } =
    await thirdPartyModel.findOne();

  const { code } = req.body;
  try {
    // Exchange authorization code for tokens
    const { data } = await axios.post(
      "https://oauth2.googleapis.com/token",
      new URLSearchParams({
        code,
        client_id: googleClientID,
        client_secret: googleClientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      },
    );

    const { id_token, access_token } = data;

    // Verify the ID token
    const ticket = await client.verifyIdToken({
      idToken: id_token,
      audience: process.env.CLIENT_ID,
    });

    const { email, name } = ticket.getPayload();

    let user = await UserModel.findOne({ email });
    if (!user) {
      user = await UserModel.create({ email, name });
    }

    const token = createToken(user);
    res.status(200).json({ message: "login success", user, token: token });
  } catch (error) {
    console.log(error);
    res.status(400).json({ error: "login failed" });
  }
});

exports.facebookLogin = asyncHandler(async (req, res, next) => {
  const dbName = req.query.databaseName;
  const db = mongoose.connection.useDb(dbName);
  const UserModel = db.model("Users", E_user_Schema);
  const { accessToken, userID } = req.body;

  try {
    const response = await axios.get(
      `https://graph.facebook.com/v13.0/${userID}`,
      {
        params: {
          access_token: accessToken,
          fields: "email, name",
        },
      },
    );

    const { email, name } = response.data;

    let user = await UserModel.findOne({ email });

    if (!user) {
      user = await UserModel.create({ email, name });
    }

    const token = createToken(user);
    res.status(200).json({ message: "login success", user, token });
  } catch (error) {
    console.log(error);
    res.status(400).json({ error: "login failed" });
  }
});
//Permissions
//Verify user permissions
exports.allowedTo = (...allowedPermissions) =>
  asyncHandler(async (req, res, next) => {
    const userId = req.user?._id;
    const companyId = normalizeCompanyId(
      req.companyId || req.body.companyId || req.companyId,
    );
    const requiredPermissions = allowedPermissions.flat().filter(Boolean);

    if (!userId) {
      return next(new ApiError("Unauthorized", 401));
    }

    if (!companyId) {
      return next(new ApiError("companyId is required", 400));
    }

    if (requiredPermissions.length === 0) {
      return next();
    }

    const user = await usersModel.findById(userId).populate({
      path: "companies.roleId",
      populate: { path: "permissions" },
    });

    if (!user) {
      return next(new ApiError(`No user by this id ${userId}`, 404));
    }

    const companyData = user.companies.find(
      (company) => String(company.companyId) === String(companyId),
    );

    if (!companyData) {
      return next(new ApiError("User not in this company", 403));
    }

    if (!companyData.active) {
      return next(new ApiError("Company access disabled", 403));
    }

    const role = companyData.roleId;

    if (!role) {
      return next(new ApiError("Role not assigned", 403));
    }

    if (role.status === "inactive" || role.active === false) {
      return next(new ApiError("Role is inactive", 403));
    }

    const permissionValues = new Set([
      role.name,
      ...(role.permissions || []).flatMap((permission) => [
        permission.key,
        permission.title,
      ]),
    ]);

    const hasAccess = requiredPermissions.some((permission) =>
      permissionValues.has(permission),
    );

    if (!hasAccess) {
      return next(new ApiError("Access denied", 403));
    }

    next();
  });

exports.checkPlanFeatures = (...allowedFeatures) =>
  asyncHandler(async (req, res, next) => {
    const companyId = normalizeCompanyId(
      req.companyId || req.query.companyId || req.body.companyId,
    );

    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return next(new ApiError("Not login", 401));
    }

    if (!companyId) {
      return next(new ApiError("companyId is required", 400));
    }

    const requiredFeatures = allowedFeatures.flat().filter(Boolean);

    if (!requiredFeatures.length) {
      return next();
    }

    const companySubscription = await companySubscriptionModel
      .findOne({ companyId: companyId })
      .lean()
      .populate("planId");

    if (!companySubscription) {
      return next(new ApiError("Company plan not found", 404));
    }

    if (!companySubscription.isActive) {
      return next(new ApiError("Company plan is inactive", 403));
    }

    const features = companySubscription.planId?.features || {};

    const notAllowed = requiredFeatures.filter(
      (feature) => features[feature] !== true,
    );

    if (notAllowed.length) {
      return next(
        new ApiError(
          `The following features are not enabled in your plan: ${notAllowed.join(
            ", ",
          )}`,
          403,
        ),
      );
    }

    req.companyPlan = companySubscription;

    next();
  });
