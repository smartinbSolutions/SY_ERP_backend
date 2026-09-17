const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const ApiError = require("../../utils/apiError");
const opportunityService = require("../../services/CRM/opportunity.service");

// ================= GET ALL =================
exports.getAllOpportunities = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  if (!companyId) return next(new ApiError("companyId is required", 400));

  const result = await opportunityService.getAllOpportunities(req);
  res.status(200).json(result);
});

// ================= GET ONE =================
exports.getOneOpportunity = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) return next(new ApiError("companyId is required", 400));
  if (!mongoose.Types.ObjectId.isValid(id))
    return next(new ApiError("Invalid ID format", 400));

  const opportunity = await opportunityService.getOneOpportunity(req);

  res.status(200).json({ status: "success", data: opportunity });
});

// ================= CREATE =================
exports.createOpportunity = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  if (!companyId) return next(new ApiError("companyId is required", 400));

  const opportunity = await opportunityService.createOpportunity(req);

  res.status(201).json({ status: "success", data: opportunity });
});

// ================= UPDATE =================
exports.updateOpportunity = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) return next(new ApiError("companyId is required", 400));
  if (!mongoose.Types.ObjectId.isValid(id))
    return next(new ApiError("Invalid ID format", 400));

  const opportunity = await opportunityService.updateOpportunity(req);

  res.status(200).json({ status: "success", data: opportunity });
});

// ================= DELETE =================
exports.deleteOpportunity = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) return next(new ApiError("companyId is required", 400));
  if (!mongoose.Types.ObjectId.isValid(id))
    return next(new ApiError("Invalid ID format", 400));

  const message = await opportunityService.deleteOpportunity(req);

  res.status(200).json({ status: "success", message });
});
