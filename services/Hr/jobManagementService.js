const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const jobsModel = require("../../models/Hr/jobManagement");

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
    .sort({ createdAt: -1 })
    .lean();

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
  req.body.companyId = companyId;
  if (!id) {
    return next(new ApiError(`No Jobs for this ID: ${id}`, 404));
  }
  const jobs = await jobsModel.findOneAndUpdate(
    { _id: id, companyId },
    req.body,
    {
      new: true,
    }
  );

  res.status(200).json({ status: "success", data: jobs });
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
