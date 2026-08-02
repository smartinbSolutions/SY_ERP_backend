const companyInfoModel = require("../../models/Settings/CompanyInfo/companyInfo.model");
const staffModel = require("../../models/Hr/Staffs/staffModel");
const StaffsModel = require("../../models/Hr/Staffs/staffModel");
const ApiError = require("../../utils/apiError");
const createToken = require("../../utils/createToken");
const bcrypt = require("bcrypt");
const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");
const sendEmail = require("../../utils/sendEmail");
const authService = require("../authService");

exports.hrLogin = asyncHandler(async (req, res, next) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;

    if (!email || !password) {
      return next(new ApiError("Email and password are required", 400));
    }

    // Get all staff accounts with this email
    const users = await StaffsModel.find({ email });

    if (!users.length) {
      return next(new ApiError("Invalid email or password", 401));
    }

    // Compare password with the first account
    const passwordMatch = users.some((user) =>
      bcrypt.compare(password, user.password),
    );

    if (!passwordMatch) {
      return next(new ApiError("Invalid email or password", 401));
    }

    // More than one company -> let user choose
    if (users.length > 1) {
      const companies = await Promise.all(
        users.map(async (user) => {
          const company = await companyInfoModel
            .findById(user.companyId)
            .select("companyName companyLogo publicId");

          return {
            staffId: user._id,
            companyId: user.companyId,
            publicId: company?.publicId,
            companyName: company?.companyName,
            companyLogo: company?.companyLogo,
          };
        }),
      );

      return res.status(200).json({
        status: true,
        needCompanySelection: true,
        companies,
      });
    }

    // Only one company -> continue login
    const user = await StaffsModel.findById(users[0]._id)
      .populate({ path: "position", select: "name -_id" })
      .populate({ path: "currency", select: "-_id -updatedAt -sync -__v" })
      .populate("branch")
      .populate("department")
      .populate({
        path: "groupId",
        populate: [
          {
            path: "leavePolicy",
            model: "LeavePolicy",
          },
          {
            path: "locationId",
            model: "hrlocation",
          },
          {
            path: "overtimePolicy",
            model: "OvertimePolicy",
          },
          {
            path: "advancePolicy",
            model: "AdvancePolicy",
          },
        ],
      })
      .populate("roleId");

    await StaffsModel.updateOne({ _id: user._id }, { $set: { session: true } });

    user.password = undefined;

    const token = createToken({
      userId: user._id,
      email: user.email,
      roleId: user.roleId,
      channels: user.channels,
      companyId: user.companyId,
      authSource: "staff",
    });

    return res.status(200).json({
      status: true,
      data: user,
      token,
    });
  } catch (error) {
    console.error("❌ Error during login:", error);
    next(error);
  }
});

exports.hrSignOut = asyncHandler(async (req, res, next) => {
  try {
    const user = await StaffsModel.findOne({
      email: req.body.email,
      session: true,
    });

    if (!user) {
      return next(new ApiError("Incorrect email", 401));
    }
    user.session = false;
    await user.save();

    res.status(200).json({
      status: "true",
      data: user,
      message: "sign Out successfuly",
      companyId: req.body.companyId,
    });
  } catch (error) {
    console.error("Error during login:", error);
    next(error);
  }
});

exports.protectStaff = asyncHandler(async (req, res, next) => {
  // const companyId = req.companyId;

  // if (!companyId) {
  //   return next(new ApiError("companyId is required", 400));
  // }

  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next(new ApiError("Not logged in", 401));
  }

  try {
    // 1️⃣ Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

    // 2️⃣ Ensure token source is STAFF
    if (decoded.authSource !== "staff") {
      return next(new ApiError("Staff access only", 403));
    }

    // 3️⃣ Check staff existence
    const currentUser = await StaffsModel.findOne({
      _id: decoded.userId,
      companyId: decoded.companyId,
    });

    if (!currentUser) {
      return next(new ApiError("Staff not found", 404));
    }
    req.companyId = decoded.companyId;

    // 4️⃣ Attach staff to request
    req.user = currentUser;
    next();
  } catch (error) {
    console.error("JWT Error:", error.message);

    if (error.name === "TokenExpiredError") {
      return next(new ApiError("Token has expired", 401));
    }

    return next(new ApiError("Invalid token", 401));
  }
});

// exports.protectERP = asyncHandler(async (req, res, next) => {
//   let token;

//   if (
//     req.headers.authorization &&
//     req.headers.authorization.startsWith("Bearer")
//   ) {
//     token = req.headers.authorization.split(" ")[1];
//   }

//   if (!token) {
//     return next(new ApiError("Not logged in", 401));
//   }

//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

//     if (decoded.authSource !== "erp") {
//       return next(new ApiError("ERP access only", 403));
//     }

//     req.companyId = decoded.companyId;
//     req.user = decoded; // أو req.erpUser
//     req.authSource = "erp";

//     next();
//   } catch (err) {
//     return next(new ApiError("Invalid token", 401));
//   }
// });

exports.erpToStaffPortal = asyncHandler(async (req, res, next) => {
  const { email, companyId } = req.erpUser;

  const staff = await StaffsModel.findOne({ email, companyId })
    .populate("branch")
    .populate({
      path: "groupId",
      populate: [
        {
          path: "locationId",
          model: "hrlocation",
        },
      ],
    });

  if (!staff) {
    return next(new ApiError("You are not registered as staff", 403));
  }

  const staffToken = createToken(staff, null, "staff");

  res.status(200).json({
    status: true,
    token: staffToken,
    data: staff,
  });
});

exports.protectStaffOrERP = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next(new ApiError("Not logged in", 401));
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    req.companyId = decoded.companyId;
    req.decoded = decoded;
  } catch (err) {
    return next(new ApiError("Invalid token", 401));
  }

  if (decoded.authSource === "staff") {
    return exports.protectStaff(req, res, next);
  }

  if (decoded.authSource === "erp") {
    return authService.protect(req, res, next);
  }

  return next(new ApiError("Invalid auth source", 401));
});

// @desc      forgot password
// @route     POST /api/hrauth/forgotPassword
// @access    Public

exports.forgotPassword = asyncHandler(async (req, res, next) => {
  const email = req.body.email?.trim().toLowerCase();

  // 1) Get all staff accounts with this email
  const staffs = await staffModel.find({ email });

  if (!staffs.length) {
    return next(
      new ApiError(`There is no staff with this email address ${email}`, 404),
    );
  }

  // 2) Generate reset code
  const resetCode = Math.floor(Math.random() * 1000000 + 1)
    .toString()
    .padStart(6, "0");

  console.log("Reset Code:", resetCode);

  // 3) Hash reset code
  const hashedResetCode = await bcrypt.hash(resetCode, 10);

  const resetExpires = Date.now() + 10 * 60 * 1000;

  // 4) Update all accounts with same email
  await staffModel.updateMany(
    { email },
    {
      $set: {
        passwordResetCode: hashedResetCode,
        passwordResetExpires: resetExpires,
        resetCodeVerified: false,
      },
    },
  );

  const message = `
Forgot your password?

Your password reset code is: ${resetCode}

This code is valid for 10 minutes.

If you didn't request this password reset, please ignore this email.
`;

  try {
    await sendEmail({
      email,
      subject: "Your Password Reset Code (valid for 10 min)",
      message,
    });

    return res.status(200).json({
      status: "Success",
      message: "Reset code sent to your email",
    });
  } catch (err) {
    // Clear reset data if email sending fails
    await staffModel.updateMany(
      { email },
      {
        $unset: {
          passwordResetCode: 1,
          passwordResetExpires: 1,
        },
        $set: {
          resetCodeVerified: false,
        },
      },
    );

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
// @route     POST /api/hrauth/verifyresetcode
// @access    Public

exports.verifyPasswordResetCode = asyncHandler(async (req, res, next) => {
  const { email, resetCode } = req.body;

  if (!email || !resetCode) {
    return next(new ApiError("Email and reset code are required", 400));
  }

  const staff = await staffModel.findOne({
    email: email.trim().toLowerCase(),
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!staff) {
    return next(new ApiError("Reset code is invalid or expired", 400));
  }

  const isResetCodeValid = await bcrypt.compare(
    resetCode,
    staff.passwordResetCode,
  );

  if (!isResetCodeValid) {
    return next(new ApiError("Reset code is invalid", 400));
  }

  await staffModel.updateMany(
    { email: email.trim().toLowerCase() },
    {
      $set: {
        resetCodeVerified: true,
      },
    },
  );

  res.status(200).json({
    status: "Success",
  });
});

// @desc      Reset password
// @route     POST /api/hrauth/resetpassword
// @access    Public
exports.resetPassword = asyncHandler(async (req, res, next) => {
  const { email, newPassword } = req.body;

  const normalizedEmail = email?.trim().toLowerCase();

  if (!normalizedEmail || !newPassword) {
    return next(new ApiError("Email and new password are required", 400));
  }

  const staff = await staffModel.findOne({
    email: normalizedEmail,
  });

  if (!staff) {
    return next(
      new ApiError(
        `There is no staff with this email address ${normalizedEmail}`,
        404,
      ),
    );
  }

  if (!staff.resetCodeVerified) {
    return next(new ApiError("Reset code not verified", 400));
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await staffModel.updateMany(
    { email: normalizedEmail },
    {
      $set: {
        password: hashedPassword,
      },
      $unset: {
        passwordResetCode: 1,
        passwordResetExpires: 1,
        resetCodeVerified: 1,
      },
    },
  );

  res.status(200).json({
    status: "Success",
    message: "Password updated successfully. Please login again.",
  });
});

exports.hrSwitchCompany = asyncHandler(async (req, res, next) => {
  const { staffId, companyId } = req.body;

  if (!staffId || !companyId) {
    return next(new ApiError("staffId and companyId are required", 400));
  }

  const staff = await staffModel
    .findOne({
      _id: staffId,
      companyId,
    })
    .populate({ path: "position", select: "name -_id" })
    .populate({ path: "currency", select: "-_id -updatedAt -sync -__v" })
    .populate("branch")
    .populate("department")
    .populate({
      path: "groupId",
      populate: [
        {
          path: "leavePolicy",
          model: "LeavePolicy",
        },
        {
          path: "locationId",
          model: "hrlocation",
        },
        {
          path: "overtimePolicy",
          model: "OvertimePolicy",
        },
        {
          path: "advancePolicy",
          model: "AdvancePolicy",
        },
      ],
    })
    .populate("roleId");

  if (!staff) {
    return next(new ApiError("You don't have access to this company", 403));
  }

  if (!staff.employmentStatus) {
    return next(new ApiError("Staff account is inactive", 403));
  }

  await staffModel.updateOne(
    { _id: staff._id },
    {
      $set: {
        session: true,
      },
    },
  );

  const company = await companyInfoModel
    .findById(companyId)
    .select("companyName companyLogo publicId");

  const token = createToken({
    userId: staff._id,
    email: staff.email,
    roleId: staff.roleId,
    channels: staff.channels,
    companyId: staff.companyId,
    authSource: "staff",
  });

  staff.password = undefined;

  res.status(200).json({
    status: true,
    data: staff,
    company,
    token,
  });
});
