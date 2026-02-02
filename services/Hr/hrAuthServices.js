const companyInfoModel = require("../../models/companyInfoModel");
const StaffsModel = require("../../models/Hr/staffModel");
const ApiError = require("../../utils/apiError");
const createToken = require("../../utils/createToken");
const bcrypt = require("bcrypt");
const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");

exports.hrLogin = asyncHandler(async (req, res, next) => {
  try {
    // Fetch the user and check email and password in parallel

    const user = await StaffsModel.findOne({
      email: req.body.email,
      // session: false,
    })
      .populate({ path: "position", select: "name -_id" })
      .populate({ path: "currency", select: "-_id -updatedAt -sync -__v" })
      .populate("branch")
      .populate("department")
      .populate("groupId")
      .populate("roleId");

    if (!user) {
      return next(
        new ApiError("Incorrect email or Have session in other divase ", 401),
      );
    }
    user.session = true;
    await user.save();
    // Check passwords
    const passwordMatch = await bcrypt.compare(
      req.body.password,
      user.password,
    );
    if (!passwordMatch) {
      return next(new ApiError("Incorrect Password", 401));
    }
    user.password = undefined;
    const companyData = await companyInfoModel.findById(user.companyId);
    const token = createToken(user, null, "staff");
    res.status(200).json({
      status: "true",
      company: companyData.companyName,
      data: user,
      token,
    });
  } catch (error) {
    console.error("Error during login:", error);
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
  const companyId = req.query.companyId;

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

    // 2️⃣ Ensure token source is STAFF
    if (decoded.authSource !== "staff") {
      return next(new ApiError("Staff access only", 403));
    }

    // 3️⃣ Check staff existence
    const currentUser = await StaffsModel.findOne({
      _id: decoded.userId,
      companyId,
    });

    if (!currentUser) {
      return next(new ApiError("Staff not found", 404));
    }

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
  const companyId = req.query.companyId;

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
    populate: {
      path: "leaveType",
      model: "leaves" 
    }
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
