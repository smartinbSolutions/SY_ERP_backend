const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const ApiError = require("../../utils/apiError");
const pipelineService = require("../../services/CRM/pipeline.service");

// ================= GET ALL =================
exports.getAllPipelines = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  if (!companyId) return next(new ApiError("companyId is required", 400));

  const result = await pipelineService.getAllPipelines(req);
  res.status(200).json(result);
});

// ================= GET ONE =================
exports.getOnePipeline = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) return next(new ApiError("companyId is required", 400));
  if (!mongoose.Types.ObjectId.isValid(id))
    return next(new ApiError("Invalid ID format", 400));

  const pipeline = await pipelineService.getOnePipeline(req);

  res.status(200).json({ status: "success", data: pipeline });
});

// ================= CREATE =================
exports.createPipeline = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  if (!companyId) return next(new ApiError("companyId is required", 400));

  const pipeline = await pipelineService.createPipeline(req);

  res.status(201).json({ status: "success", data: pipeline });
});

// ================= UPDATE =================
exports.updatePipeline = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) return next(new ApiError("companyId is required", 400));
  if (!mongoose.Types.ObjectId.isValid(id))
    return next(new ApiError("Invalid ID format", 400));

  const pipeline = await pipelineService.updatePipeline(req);

  res.status(200).json({ status: "success", data: pipeline });
});

// ================= DELETE =================
exports.deletePipeline = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) return next(new ApiError("companyId is required", 400));
  if (!mongoose.Types.ObjectId.isValid(id))
    return next(new ApiError("Invalid ID format", 400));

  const message = await pipelineService.deletePipeline(req);

  res.status(200).json({ status: "success", message });
});
