const { default: slugify } = require("slugify");
const investorModel = require("../../models/investment/investorModel");
const createToken = require("../../utils/createToken");
const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const SESSION_MAX_AGE = 1000 * 60 * 60 * 24;

exports.investorLogin = asyncHandler(async (req, res, next) => {
  const user = await investorModel.findOne({
    phoneNumber: req.body.phoneNumber,
  });

  if (!user) {
    return next(new ApiError("No account found with that phone number", 404));
  }

  const passwordMatch = await bcrypt.compare(req.body.password, user.password);

  if (!passwordMatch) {
    return next(new ApiError("Incorrect Password", 401));
  }

  if (!user.active) {
    return next(new ApiError("The account is not active", 401));
  }

  // AUTO-EXPIRE CHECK
  if (user.activeSessionId && user.sessionStartedAt) {
    const sessionAge = Date.now() - new Date(user.sessionStartedAt).getTime();

    if (sessionAge < SESSION_MAX_AGE) {
      return next(
        new ApiError(
          "Account already logged in on another device. Please log out first.",
          403
        )
      );
    }

    // Session expired → clean it
    user.activeSessionId = null;
    user.sessionStartedAt = null;
  }

  // Create new session
  const sessionId = crypto.randomUUID();

  user.activeSessionId = sessionId;
  user.sessionStartedAt = new Date();
  await user.save();

  const token = createToken(user, sessionId);

  const userObj = user.toObject();
  delete userObj.password;

  res.status(200).json({
    status: true,
    user: userObj,
    token,
  });
});

exports.investorRegister = asyncHandler(async (req, res, next) => {
  let user;
  user = await investorModel.findOne({
    phoneNumber: req.body.phoneNumber,
  });

  if (user) {
    return next(
      new ApiError("An account with that phone number already exists", 500)
    );
  }

  req.body.slug = slugify(req.body.fullName);
  const hashedPassword = await bcrypt.hash(req.body.password, 10);
  user = await investorModel.create({
    fullName: req.body.fullName,
    slug: req.body.slug,
    phoneNumber: req.body.phoneNumber,
    active: true,
    password: hashedPassword,
    companyId: req.body.companyId,
  });

  const token = createToken(user);
  const userObj = user.toObject();
  delete userObj.password;

  res.status(201).json({ user: userObj, token });
});

exports.protectInvestor = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next(new ApiError("Not authenticated", 401));
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

  const user = await investorModel.findById(decoded.userId);

  if (!user || !user.activeSessionId || !user.sessionStartedAt) {
    return next(new ApiError("Session expired. Please log in again.", 401));
  }

  // AUTO-EXPIRE CHECK
  const sessionAge = Date.now() - new Date(user.sessionStartedAt).getTime();

  if (sessionAge > SESSION_MAX_AGE) {
    user.activeSessionId = null;
    user.sessionStartedAt = null;
    await user.save();

    return next(new ApiError("Session expired. Please log in again.", 401));
  }

  // SESSION MATCH CHECK
  if (user.activeSessionId !== decoded.sessionId) {
    return next(new ApiError("Session expired. Please log in again.", 401));
  }

  req.user = user;
  next();
});

exports.investorLogout = asyncHandler(async (req, res) => {
  if (req.user) {
    req.user.activeSessionId = null;
    req.user.sessionStartedAt = null;
    await req.user.save();
  }

  res.status(200).json({
    message: "Logged out successfully",
  });
});
