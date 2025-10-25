const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const jobsModel = require("../../models/Hr/jobManagement");
const multer = require("multer");
const sharp = require("sharp");
const { v4: uuidv4 } = require("uuid");

const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image")) {
    cb(null, true);
  } else {
    cb(new ApiError("Only images are allowed", 400), false);
  }
};

const upload = multer({ storage: multerStorage, fileFilter: multerFilter });

exports.uploadCompanyLogo = upload.single("companyInfo.logo");

exports.resizeCompanyLogo = asyncHandler(async (req, res, next) => {
  if (!req.file) return next();

  const filename = `company-logo-${uuidv4()}-${Date.now()}.png`;

  await sharp(req.file.buffer)
    .toFormat("png")
    .png({ quality: 70 })
    .toFile(`uploads/jobManagement/${filename}`);

  if (!req.body.companyInfo) req.body.companyInfo = {};
  req.body.companyInfo.logo = filename;

  next();
});

exports.getAllJobs = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const query = { companyId };

  if (req.query.keyword) {
    query.$or = [{ jobTitle: { $regex: req.query.keyword, $options: "i" } }];
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const total = await jobsModel.countDocuments(query);

  const jobs = await jobsModel
    .find(query)
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: "success",
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results: jobs.length,
    data: jobs,
  });
});

exports.getOneJob = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  if (!req.params.id) {
    return next(new ApiError(`No Jobs for this ID: ${req.params.id}`, 404));
  }
  const jobs = await jobsModel.findOne({
    _id: req.params.id,
    companyId,
  });
  res.status(200).json({ status: "success", data: jobs });
});

exports.createJobs = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  req.body.companyId = companyId;
  const jobs = await jobsModel.create(req.body);
  res.status(200).json({ status: "success", data: jobs });
});

exports.updateJob = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const { id } = req.params;
  if (!id) {
    return next(new ApiError(`No Jobs for this ID: ${id}`, 404));
  }

  req.body.companyId = companyId;

  if (req.body.companyInfo && typeof req.body.companyInfo === "string") {
    try {
      req.body.companyInfo = JSON.parse(req.body.companyInfo);
    } catch (err) {
      return next(new ApiError("companyInfo must be a valid object", 400));
    }
  }

  const updateData = { ...req.body };

  if (req.body.companyInfo && typeof req.body.companyInfo === "object") {
    for (const key in req.body.companyInfo) {
      updateData[`companyInfo.${key}`] = req.body.companyInfo[key];
    }
    delete updateData.companyInfo; 
  }

  const updatedJob = await jobsModel.findOneAndUpdate(
    { _id: id, companyId },
    { $set: updateData },
    { new: true }
  );

  if (!updatedJob) {
    return next(new ApiError(`No Jobs found with ID: ${id}`, 404));
  }

  res.status(200).json({
    status: "success",
    data: updatedJob,
  });
});

exports.deleteJob = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const { id } = req.params;
  if (!id) {
    return next(new ApiError(`No Jobs for this ID:${id}`, 404));
  }
  const jobs = await jobsModel.findOneAndDelete({
    _id: id,
    companyId,
  });
  res.status(200).json({ status: "success", data: jobs });
});
