const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const ApiError = require("../../utils/apiError");
const lookupService = require("../../services/CRM/lookup.service");

// ================= GET ALL =================
exports.getAllLookups = asyncHandler(async (req, res, next) => {
  if (!req.companyId) return next(new ApiError("companyId is required", 400));

  const data = await lookupService.getAllLookups(req);
  res.status(200).json({ status: "success", results: data.length, data });
});

// ================= GET ONE =================
exports.getOneLookup = asyncHandler(async (req, res, next) => {
  if (!req.companyId) return next(new ApiError("companyId is required", 400));
  if (!mongoose.Types.ObjectId.isValid(req.params.id))
    return next(new ApiError("Invalid ID format", 400));

  const data = await lookupService.getOneLookup(req);
  res.status(200).json({ status: "success", data });
});

// ================= CREATE =================
exports.createLookup = asyncHandler(async (req, res, next) => {
  if (!req.companyId) return next(new ApiError("companyId is required", 400));

  const data = await lookupService.createLookup(req);
  res.status(201).json({ status: "success", data });
});

// ================= UPDATE =================
exports.updateLookup = asyncHandler(async (req, res, next) => {
  if (!req.companyId) return next(new ApiError("companyId is required", 400));
  if (!mongoose.Types.ObjectId.isValid(req.params.id))
    return next(new ApiError("Invalid ID format", 400));

  const data = await lookupService.updateLookup(req);
  res.status(200).json({ status: "success", data });
});

// ================= DELETE =================
exports.deleteLookup = asyncHandler(async (req, res, next) => {
  if (!req.companyId) return next(new ApiError("companyId is required", 400));
  if (!mongoose.Types.ObjectId.isValid(req.params.id))
    return next(new ApiError("Invalid ID format", 400));

  const message = await lookupService.deleteLookup(req);
  res.status(200).json({ status: "success", message });
});
