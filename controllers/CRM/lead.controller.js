const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const ApiError = require("../../utils/apiError");
const leadService = require("../../services/CRM/lead.service");

// ================= GET ALL =================
exports.getAllLeads = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  if (!companyId) return next(new ApiError("companyId is required", 400));

  const result = await leadService.getAllLeads(req);
  res.status(200).json(result);
});

// ================= GET ONE =================
exports.getOneLead = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) return next(new ApiError("companyId is required", 400));
  if (!mongoose.Types.ObjectId.isValid(id))
    return next(new ApiError("Invalid ID format", 400));

  const lead = await leadService.getOneLead(req);

  res.status(200).json({ status: "success", data: lead });
});

// ================= CREATE =================
exports.createLead = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  if (!companyId) return next(new ApiError("companyId is required", 400));

  const lead = await leadService.createLead(req);

  res.status(201).json({ status: "success", data: lead });
});

// ================= UPDATE =================
exports.updateLead = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) return next(new ApiError("companyId is required", 400));
  if (!mongoose.Types.ObjectId.isValid(id))
    return next(new ApiError("Invalid ID format", 400));

  const lead = await leadService.updateLead(req);

  res.status(200).json({ status: "success", data: lead });
});

// ================= DELETE =================
exports.deleteLead = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) return next(new ApiError("companyId is required", 400));
  if (!mongoose.Types.ObjectId.isValid(id))
    return next(new ApiError("Invalid ID format", 400));

  const message = await leadService.deleteLead(req);

  res.status(200).json({ status: "success", message });
});

// QUALIFY
exports.qualifyLead = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ApiError("Invalid ID format", 400));
  }

  const lead = await leadService.qualifyLead(req);

  res.status(200).json({
    status: "success",
    message: "Lead qualified successfully",
    data: lead,
  });
});
