const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const ApiError = require("../../utils/apiError");
const companyService = require("../../services/CRM/company.service");

// ================= GET ALL =================
exports.getAllCompanies = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  if (!companyId) return next(new ApiError("companyId is required", 400));

  const result = await companyService.getAllCompanies(req);
  res.status(200).json(result);
});

// ================= GET ONE =================
exports.getOneCompany = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) return next(new ApiError("companyId is required", 400));
  if (!mongoose.Types.ObjectId.isValid(id))
    return next(new ApiError("Invalid ID format", 400));

  const company = await companyService.getOneCompany(req);

  res.status(200).json({ status: "success", data: company });
});

// ================= CREATE =================
exports.createCompany = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  if (!companyId) return next(new ApiError("companyId is required", 400));

  const company = await companyService.createCompany(req);

  res.status(201).json({ status: "success", data: company });
});

// ================= UPDATE =================
exports.updateCompany = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) return next(new ApiError("companyId is required", 400));
  if (!mongoose.Types.ObjectId.isValid(id))
    return next(new ApiError("Invalid ID format", 400));

  const company = await companyService.updateCompany(req);

  res.status(200).json({ status: "success", data: company });
});

// ================= DELETE =================
exports.deleteCompany = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) return next(new ApiError("companyId is required", 400));
  if (!mongoose.Types.ObjectId.isValid(id))
    return next(new ApiError("Invalid ID format", 400));

  const message = await companyService.deleteCompany(req);

  res.status(200).json({ status: "success", message });
});
