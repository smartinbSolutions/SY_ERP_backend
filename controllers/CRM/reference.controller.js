const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const ApiError = require("../../utils/apiError");
const referenceService = require("../../services/CRM/reference.service");

// ================= GET ALL =================
exports.getAllReferences = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  if (!companyId) return next(new ApiError("companyId is required", 400));

  const data = await referenceService.getAllReferences(req);
  res.status(200).json({ status: "success", results: data.length, data });
});

// ================= GET ONE =================
exports.getOneReference = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) return next(new ApiError("companyId is required", 400));
  if (!mongoose.Types.ObjectId.isValid(id))
    return next(new ApiError("Invalid ID format", 400));

  const data = await referenceService.getOneReference(req);
  res.status(200).json({ status: "success", data });
});

// ================= CREATE =================
exports.createReference = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  if (!companyId) return next(new ApiError("companyId is required", 400));

  const data = await referenceService.createReference(req);
  res.status(201).json({ status: "success", data });
});

// ================= UPDATE =================
exports.updateReference = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) return next(new ApiError("companyId is required", 400));
  if (!mongoose.Types.ObjectId.isValid(id))
    return next(new ApiError("Invalid ID format", 400));

  const data = await referenceService.updateReference(req);
  res.status(200).json({ status: "success", data });
});

// ================= DELETE =================
exports.deleteReference = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) return next(new ApiError("companyId is required", 400));
  if (!mongoose.Types.ObjectId.isValid(id))
    return next(new ApiError("Invalid ID format", 400));

  const message = await referenceService.deleteReference(req);
  res.status(200).json({ status: "success", message });
});
