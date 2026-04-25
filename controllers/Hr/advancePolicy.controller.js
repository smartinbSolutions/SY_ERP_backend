const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const ApiError = require("../../utils/apiError");
const service = require("../../services/Hr/Advance/advancePolicyService");

// ================= GET ALL =================
exports.getAllPolicies = asyncHandler(async (req, res, next) => {
  const { companyId, keyword } = req.query;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;

  const { policies, total } = await service.getAllPolicies({
    companyId,
    page,
    limit,
    keyword,
  });

  res.status(200).json({
    status: "success",
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results: policies.length,
    data: policies,
  });
});

// ================= GET ONE =================
exports.getOnePolicy = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { id } = req.params;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ApiError("Invalid ID format", 400));
  }

  const policy = await service.getPolicyById(companyId, id);

  res.status(200).json({
    status: "success",
    data: policy,
  });
});

// ================= CREATE =================
exports.createPolicy = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { policyName, code, types, approvalFlow } = req.body;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  if (!types || !Array.isArray(types) || types.length === 0) {
    return next(
      new ApiError("Policy must contain at least one advance type", 400),
    );
  }

  const result = await service.createPolicy({
    companyId,
    policyName,
    code,
    types,
    approvalFlow,
  });

  res.status(201).json({
    status: "success",
    data: result,
  });
});

// ================= UPDATE =================
exports.updatePolicy = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { id } = req.params;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ApiError("Invalid ID format", 400));
  }

  const policy = await service.updatePolicy(companyId, id, req.body);

  res.status(200).json({
    status: "success",
    data: policy,
  });
});

// ================= DELETE =================
exports.deletePolicy = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { id } = req.params;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ApiError("Invalid ID format", 400));
  }

  await service.deletePolicy(companyId, id);

  res.status(200).json({
    status: "success",
    message: "Advance policy and related types deleted successfully",
  });
});
