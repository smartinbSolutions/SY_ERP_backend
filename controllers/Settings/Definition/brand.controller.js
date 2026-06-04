const mongoose = require("mongoose");
const multer = require("multer");
const multerStorage = multer.memoryStorage();
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");
const asyncHandler = require("express-async-handler");
const ApiError = require("../../../utils/apiError");
const brandService = require("../../../services/Settings/Definition/brand.service");

const multerFilter = function (req, file, cb) {
  if (file.mimetype.startsWith("image")) {
    cb(null, true);
  } else {
    cb(new ApiError("Only images Allowed", 400), false);
  }
};

const upload = multer({ storage: multerStorage, fileFilter: multerFilter });

exports.uploadBrandImage = upload.single("image");

exports.resizerBrandImage = asyncHandler(async (req, res, next) => {
  const filename = `brand-${uuidv4()}-${Date.now()}.png`;

  if (req.file) {
    await sharp(req.file.buffer)
      .toFormat("png")
      .png({ quality: 50 })
      .toFile(`uploads/brand/${filename}`);

    //save image into our db
    req.body.image = filename;
  }

  next();
});

exports.getBrands = asyncHandler(async (req, res) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const result = await brandService.getBrands({
    companyId,
    page,
    limit,
    keyword: req.query.keyword || "",
  });

  return res.status(200).json({
    status: "success",
    pages: result.pages,
    results: result.results,
    data: result.data,
  });
});

exports.getBrand = asyncHandler(async (req, res) => {
  const companyId = req.query.companyId;
  const id = req.params.id;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const result = await brandService.getBrand({
    companyId,
    id,
  });
  return res.status(200).json({
    status: "success",
    data: result.data,
  });
});

exports.createBrand = asyncHandler(async (req, res) => {
  const companyId = req.query.companyId;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  console.log(companyId);

  const session = await mongoose.startSession();
  session.startTransaction();
  const result = await brandService.createBrand({
    companyId,
    data: req.body,
    session,
  });
  await session.commitTransaction();
  session.endSession();

  return res.status(200).json({
    status: "success",
    data: result.data,
  });
});

exports.updateBrand = asyncHandler(async (req, res) => {
  const companyId = req.query.companyId;
  const id = req.params.id;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const session = await mongoose.startSession();
  session.startTransaction();
  const result = await brandService.updateBrand({
    companyId,
    id,
    data: req.body,
    session,
  });
  await session.commitTransaction();
  session.endSession();
  return res.status(200).json({
    status: "success",
    data: result.data,
  });
});

exports.deleteBrand = asyncHandler(async (req, res) => {
  const companyId = req.query.companyId;
  const id = req.params.id;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const result = await brandService.deleteBrand({
      companyId,
      id,
      session,
    });
    await session.commitTransaction();
    return res.status(200).json({
      status: "success",
      data: result.data,
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
});
