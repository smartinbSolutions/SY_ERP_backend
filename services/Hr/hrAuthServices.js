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
      .populate({ path: "currency", select: "-_id -updatedAt -sync -__v" });

    if (!user) {
      return next(
        new ApiError("Incorrect email or Have session in other divase ", 401)
      );
    }
    user.session = true;
    await user.save();
    // Check password
    const passwordMatch = await bcrypt.compare(
      req.body.password,
      user.password
    );
    if (!passwordMatch) {
      return next(new ApiError("Incorrect Password", 401));
    }
    user.password = undefined;
    const companyData = await companyInfoModel.findById(user.companyId);
    const token = createToken(user);
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

exports.hrSingOut = asyncHandler(async (req, res, next) => {
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
      message: "sing Out successfuly",
      companyId: req.body.companyId,
    });
  } catch (error) {
    console.error("Error during login:", error);
    next(error);
  }
});

exports.protect = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next(new ApiError("Not login", 401));
  } else {
    try {
      //2- Verify token (no change happens, expired token)
      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

      //3-Check if user exists

      const curentUser = await StaffsModel.findOne({
        _id: decoded.userId,
        companyId: companyId,
      });
      console.log(decoded.userId);

      if (!curentUser) {
        return next(new ApiError("The user does not exit", 404));
      }
      req.user = curentUser;
      next();
    } catch (error) {
      // Token verification failed
      console.error("JWT Error:", error.message);
      if (error.name === "TokenExpiredError") {
        return next(new ApiError("Token has expired", 401));
      } else {
        console.error("JWT Error:", error.message);
        return next(new ApiError("Not login", 401));
      }
    }
  }
});
