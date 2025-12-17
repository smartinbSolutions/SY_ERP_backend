const { default: slugify } = require("slugify");
const investorModel = require("../../models/investment/investorModel");
const createToken = require("../../utils/createToken");
const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const bcrypt = require("bcrypt");

exports.investorLogin = asyncHandler(async (req, res, next) => {
  try {
    const user = await investorModel.findOne({
      phoneNumber: req.body.phoneNumber,
    });

    if (!user) {
      return next(new ApiError("No account found with that phone number", 404));
    }

    // Check password
    const passwordMatch = await bcrypt.compare(
      req.body.password,
      user.password
    );
    if (!passwordMatch) {
      return next(new ApiError("Incorrect Password", 401));
    }

    // Check if the user is active
    if (!user.active) {
      return next(new ApiError("The account is not active", 401));
    }

    const userObj = user.toObject();
    delete userObj.password;

    const token = createToken(user);
    res.status(200).json({
      status: "true",
      user: userObj,
      token,
      companyId: req.body.companyId,
    });
  } catch (error) {
    console.error("Error during login:", error);
    next(error);
  }
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
