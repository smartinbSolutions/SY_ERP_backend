const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const ApiError = require("../../utils/apiError");
const activityService = require("../../services/CRM/activity.service");

// ================= GET ALL =================
exports.getAllActivities = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  if (!companyId) return next(new ApiError("companyId is required", 400));

  const result = await activityService.getAllActivities(req);
  res.status(200).json(result);
});

// ================= GET ONE =================
exports.getOneActivity = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) return next(new ApiError("companyId is required", 400));
  if (!mongoose.Types.ObjectId.isValid(id))
    return next(new ApiError("Invalid ID format", 400));

  const activity = await activityService.getOneActivity(req);

  res.status(200).json({ status: "success", data: activity });
});

// ================= CREATE =================
exports.createActivity = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  if (!companyId) return next(new ApiError("companyId is required", 400));

  const activity = await activityService.createActivity(req);

  res.status(201).json({ status: "success", data: activity });
});

// ================= UPDATE =================
exports.updateActivity = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) return next(new ApiError("companyId is required", 400));
  if (!mongoose.Types.ObjectId.isValid(id))
    return next(new ApiError("Invalid ID format", 400));

  const activity = await activityService.updateActivity(req);

  res.status(200).json({ status: "success", data: activity });
});

// ================= DELETE =================
exports.deleteActivity = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) return next(new ApiError("companyId is required", 400));
  if (!mongoose.Types.ObjectId.isValid(id))
    return next(new ApiError("Invalid ID format", 400));

  const message = await activityService.deleteActivity(req);

  res.status(200).json({ status: "success", message });
});
