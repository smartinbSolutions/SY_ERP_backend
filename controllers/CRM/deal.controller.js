const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const ApiError = require("../../utils/apiError");
const dealService = require("../../services/CRM/deal.service");

// ================= GET ALL =================
exports.getAllDeals = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  if (!companyId) return next(new ApiError("companyId is required", 400));

  const result = await dealService.getAllDeals(req);
  res.status(200).json(result);
});

// ================= GET ONE =================
exports.getOneDeal = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) return next(new ApiError("companyId is required", 400));
  if (!mongoose.Types.ObjectId.isValid(id))
    return next(new ApiError("Invalid ID format", 400));

  const deal = await dealService.getOneDeal(req);

  res.status(200).json({ status: "success", data: deal });
});

// ================= CREATE =================
exports.createDeal = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  if (!companyId) return next(new ApiError("companyId is required", 400));

  const deal = await dealService.createDeal(req);

  res.status(201).json({ status: "success", data: deal });
});

// ================= UPDATE =================
exports.updateDeal = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) return next(new ApiError("companyId is required", 400));
  if (!mongoose.Types.ObjectId.isValid(id))
    return next(new ApiError("Invalid ID format", 400));

  const deal = await dealService.updateDeal(req);

  res.status(200).json({ status: "success", data: deal });
});

// ================= DELETE =================
exports.deleteDeal = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) return next(new ApiError("companyId is required", 400));
  if (!mongoose.Types.ObjectId.isValid(id))
    return next(new ApiError("Invalid ID format", 400));

  const message = await dealService.deleteDeal(req);

  res.status(200).json({ status: "success", message });
});
