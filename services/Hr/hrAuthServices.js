const companyInfoModel = require("../../models/Settings/CompanyInfo/companyInfo.model");
const staffModel = require("../../models/Hr/Staffs/staffModel");
const StaffsModel = require("../../models/Hr/Staffs/staffModel");
const ApiError = require("../../utils/apiError");
const createToken = require("../../utils/createToken");
const bcrypt = require("bcrypt");
const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");
const sendEmail = require("../../utils/sendEmail");

exports.hrLogin = asyncHandler(async (req, res, next) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;

    if (!email || !password) {
      return next(new ApiError("Email and password are required", 400));
    }

    // 🔍 Find user only by email
    const user = await StaffsModel.findOne({ email })
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

    // ❌ user not found
    if (!user) {
      console.log("❌ User not found");
      return next(new ApiError("Invalid email or password", 401));
    }

    // 🔐 Compare password
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      console.log("❌ Incorrect password");
      return next(new ApiError("Incorrect password", 401));
    }

    await StaffsModel.updateOne({ _id: user._id }, { $set: { session: true } });

    user.password = undefined;

    // 🎟 generate token
    const token = createToken({
      userId: user._id,
      email: user.email,
      roleId: user.roleId,
      channels: user.channels,
      companyId: user.companyId,
      authSource: "staff",
    });
    console.log("✅ Token Generated");

    res.status(200).json({
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

exports.protectERP = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

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

    // 2️⃣ Ensure token source is ERP
    if (decoded.authSource !== "erp") {
      return next(new ApiError("ERP access only", 403));
    }

    // 3️⃣ ERP user MUST exist as Staff
    const staffUser = await StaffsModel.findOne({
      email: decoded.email,
      companyId,
    });

    if (!staffUser) {
      return next(new ApiError("ERP user is not registered as staff", 403));
    }

    // 4️⃣ Attach staff (not ERP user!)
    req.erpUser = staffUser;
    req.authSource = "erp";

    next();
  } catch (error) {
    console.error("JWT Error:", error.message);

    if (error.name === "TokenExpiredError") {
      return next(new ApiError("Token expired", 401));
    }

    return next(new ApiError("Invalid token", 401));
  }
});

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
    return exports.protectERP(req, res, next);
  }

  return next(new ApiError("Invalid auth source", 401));
});

// @desc      forgot password
// @route     POST /api/hrauth/forgotPassword
// @access    Public

exports.forgotPassword = asyncHandler(async (req, res, next) => {
  // 1) Get user by email
  const { email } = req.body;
  const staff = await staffModel.findOne({ email });
  if (!staff) {
    return next(
      new ApiError(`There is no staff with this email address ${email}`, 404),
    );
  }

  const resetCode = Math.floor(Math.random() * 1000000 + 1).toString();
  const hashedResetCode = await bcrypt.hash(resetCode, 10);
  console.log(resetCode);

  staff.passwordResetCode = hashedResetCode;
  //10 min
  staff.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  staff.resetCodeVerified = false;
  await staff.save();

  const message = `Forgot your password? Submit this reset password code: ${resetCode}\n If you didn't forget your password, please ignore this email!`;

  try {
    await sendEmail({
      email: staff.email,
      subject: "Your Password Reset Code (valid for 10 min)",
      message,
    });

    res.status(200).json({
      status: "Success",
      message: "Reset code sent to your email",
    });
  } catch (err) {
    staff.passwordResetCode = undefined;
    staff.passwordResetExpires = undefined;
    await staff.save({ validateBeforeSave: false });
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
    email,
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

  staff.resetCodeVerified = true;
  await staff.save();

  res.status(200).json({
    status: "Success",
  });
});

// @desc      Reset password
// @route     POST /api/hrauth/resetpassword
// @access    Public
exports.resetPassword = asyncHandler(async (req, res, next) => {
  const { email, newPassword } = req.body;

  // 1) Get staff based on email
  const staff = await staffModel.findOne({
    email,
  });

  console.log(staff.resetCodeVerified);

  if (!staff) {
    return next(
      new ApiError(
        `There is no staff with this email address ${req.body.email}`,
        404,
      ),
    );
  }
  if (!staff.resetCodeVerified) {
    return next(new ApiError("reset code not verified", 400));
  }
  const hashedResetCode = await bcrypt.hash(newPassword, 10);

  staff.password = hashedResetCode;
  staff.passwordResetCode = undefined;
  staff.passwordResetExpires = undefined;
  staff.resetCodeVerified = undefined;
  await staff.save();

  const token = createToken(staff);

  res.status(200).json({ staff: staff, token });
});
