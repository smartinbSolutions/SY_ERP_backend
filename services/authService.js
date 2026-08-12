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
const currencyModel = require("../models/Settings/currency.model");

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

  // if (!role.channels.includes("dashboard")) {
  //   return next(new ApiError("No dashboard access", 403));
  // }

const settings = await userCompanySettingsModel
  .findOne({ companyId, userId: user._id })
  .select("selectedQuickActions salesPoint")
  .populate({
    path: "salesPoint",
    populate: { path: "salesPointCurrency" },
  })
  .lean();

  const userData = user.toObject();
  userData.password = undefined;
  userData.settings = settings || null;
  userData.selectedQuickActions = settings?.selectedQuickActions || [];

  const companyPlan = await companyPlanModel
    .findOne({ companyId: companyId })
    .lean();
  const company = await companyInfoModel.findById({ _id: companyId }).lean();
  const token = createToken({
    userId: user._id,
    email: user.email,
    roleId: role._id,
    channels: role.channels,
    companyId,
    authSource: "erp",
  });
  const currency = await currencyModel.findOne({
    is_primary: true,
    companyId: companyId,
  });
  res.status(200).json({
    status: true,
    data: userData,
    role,
    token,
    company,
    companyPlan,
    currency,
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
  const now = new Date();

  const subscription = await companySubscriptionModel.findOne({
    companyId,
    endDate: { $gte: now },
  });

  if (!subscription) {
    return next(
      new ApiError(
        "Your subscription has expired. Please renew your subscription.",
        403,
      ),
    );
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

exports.switchCompany = asyncHandler(async (req, res, next) => {
  const { companyId, userId } = req.body;

  if (!companyId) {
    return res.status(400).json({
      message: "Company id is required",
    });
  }
  const company = await companyInfoModel.findOne({ publicId: companyId });
  const user = await usersModel.findById(userId).populate({
    path: "companies.roleId",
    populate: { path: "permissions" },
  });

  if (!user) {
    return res.status(404).json({
      message: "User not found",
    });
  }

  const selectedCompany = user.companies.find(
    (item) => item.companyId.toString() === company._id.toString(),
  );

  if (!selectedCompany) {
    return res.status(403).json({
      message: "You don't have access to this company",
    });
  }
  const role = selectedCompany.roleId;

  if (!role.channels.includes("dashboard")) {
    return next(new ApiError("No dashboard access", 403));
  }

  const companyPlan = await companyPlanModel
    .findOne({ companyId: company._id })
    .lean();

  if (!companyPlan) {
    return next(new ApiError("No Plan", 403));
  }

  const token = createToken({
    userId: user._id,
    email: user.email,
    roleId: role._id,
    channels: role.channels,
    companyId: company._id,
    authSource: "erp",
  });
  const currency = await currencyModel.findOne({
    is_primary: true,
    companyId: company._id,
  });
  const now = new Date();

  const subscription = await companySubscriptionModel.findOne({
    companyId: company._id,
    endDate: { $gte: now },
  });
  if (!subscription) {
    return next(
      new ApiError(
        "Your subscription has expired. Please renew your subscription.",
        403,
      ),
    );
  }
  res.status(200).json({
    status: true,
    data: user,
    role,
    token,
    company,
    companyPlan,
    currency,
  });
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

// @desc      Forgot password
// @route     POST /api/auth/forgotpassword
// @access    Public
exports.forgotPassword = asyncHandler(async (req, res, next) => {
  // 1) Get user by email
  const { email } = req.body;
  const user = await usersModel.findOne({ email });

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
  user.passwordResetVerified = false;
  await user.save();

  // 3) Send password reset code via email
  try {
    await sendEmail({
      email: user.email,
      subject: "🔐 Your Password Reset Code (valid for 10 min)",
      message: `

<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
<tr>
<td align="center">


<table width="560" cellpadding="0" cellspacing="0"
style="
background:#ffffff;
border-radius:14px;
overflow:hidden;
box-shadow:0 5px 20px rgba(0,0,0,0.08);
">


<!-- Header -->

<tr>
<td style="
background:#2563eb;
padding:35px;
text-align:center;
">

<div style="
font-size:38px;
margin-bottom:10px;
">
🔐
</div>

<h1 style="
margin:0;
color:white;
font-size:24px;
">
SmartERP
</h1>

<p style="
margin:8px 0 0;
color:#dbeafe;
font-size:14px;
">
Password Recovery
</p>


</td>
</tr>




<!-- Body -->

<tr>
<td style="padding:40px;">


<p style="
margin:0 0 15px;
font-size:16px;
color:#334155;
">
Hello <strong>${user.name}</strong> 👋
</p>


<p style="
margin:0 0 25px;
font-size:14px;
line-height:1.7;
color:#64748b;
">
We received a request to reset your SmartERP account password.
Use the verification code below to continue.
</p>




<!-- OTP BOX -->

<table width="100%" cellpadding="0" cellspacing="0">
<tr>
<td style="
background:#f1f5ff;
border-radius:12px;
padding:25px;
text-align:center;
border:1px solid #dbeafe;
">


<p style="
margin:0 0 12px;
font-size:12px;
color:#64748b;
text-transform:uppercase;
letter-spacing:1.5px;
">
Verification Code
</p>


<p style="
margin:0;
font-size:36px;
font-weight:700;
letter-spacing:8px;
color:#2563eb;
">
${resetCode}
</p>


</td>
</tr>
</table>




<!-- Timer -->

<div style="
margin-top:25px;
background:#fff7ed;
padding:15px;
border-radius:8px;
text-align:center;
">

<p style="
margin:0;
font-size:13px;
color:#c2410c;
">
⏱ This code will expire in <strong>10 minutes</strong>.
</p>

</div>





<!-- Security -->

<p style="
margin-top:30px;
font-size:13px;
color:#94a3b8;
line-height:1.6;
">

If you didn't request this password reset, you can safely ignore this email.
Your account remains secure.

</p>


</td>
</tr>




<!-- Footer -->

<tr>
<td style="
background:#f8fafc;
padding:22px;
text-align:center;
border-top:1px solid #e5e7eb;
">

<p style="
margin:0;
font-size:12px;
color:#94a3b8;
">

This is an automated message — please do not reply.

<br/>

© ${new Date().getFullYear()} SmartERP · noreply@smartinb.com

</p>

</td>
</tr>



</table>


</td>
</tr>
</table>


</body>
</html>

`,
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
exports.verifyPasswordResetCode = asyncHandler(async (req, res, next) => {
  const { resetCode, email } = req.body;

  const user = await usersModel.findOne({
    passwordResetExpires: { $gt: Date.now() },
    passwordResetVerified: false,
    email,
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
  user.passwordResetVerified = true;
  await user.save();

  res.status(200).json({
    status: "Success",
  });
});

// @desc      Reset password
// @route     POST /api/auth/resetpasswordpos
// @access    Public
exports.resetPassword = asyncHandler(async (req, res, next) => {
  // 1) Get user based on email
  const user = await usersModel.findOne({
    email: req.body.email,
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
  if (!user.passwordResetVerified) {
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
