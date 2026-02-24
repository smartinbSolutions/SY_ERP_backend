const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const OvertimePolicy = require("../../models/Hr/overtimePolicyModel");
const mongoose = require("mongoose");

/*
==============================
GET ALL POLICIES
==============================
*/
exports.getAllPolicies = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const query = { companyId };

  const total = await OvertimePolicy.countDocuments(query);

  const policies = await OvertimePolicy.find(query)
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: "success",
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results: policies.length,
    data: policies,
  });
});

/*
==============================
GET ONE POLICY
==============================
*/
exports.getOnePolicy = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { id } = req.params;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ApiError("Invalid ID format", 400));
  }

  const policy = await OvertimePolicy.findOne({ _id: id, companyId });

  if (!policy) {
    return next(new ApiError(`No policy found with ID: ${id}`, 404));
  }

  res.status(200).json({
    status: "success",
    data: policy,
  });
});

/*
==============================
CREATE POLICY
==============================
*/
exports.createPolicy = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { policyName, code } = req.body;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  if (!policyName) {
    return next(new ApiError("policyName is required", 400));
  }

  const policy = await OvertimePolicy.create({
    policyName,
    code,
    companyId,
  });

  res.status(201).json({
    status: "success",
    data: policy,
  });
});

/*
==============================
UPDATE POLICY
==============================
*/
exports.updatePolicy = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { id } = req.params;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ApiError("Invalid ID format", 400));
  }

  const updateData = {};

  if (req.body.policyName !== undefined)
    updateData.policyName = req.body.policyName;

  if (req.body.code !== undefined) updateData.code = req.body.code;

  const policy = await OvertimePolicy.findOneAndUpdate(
    { _id: id, companyId },
    updateData,
    {
      new: true,
      runValidators: true,
    },
  );

  if (!policy) {
    return next(new ApiError(`No policy found with ID: ${id}`, 404));
  }

  res.status(200).json({
    status: "success",
    data: policy,
  });
});

/*
==============================
DELETE POLICY
==============================
*/
exports.deletePolicy = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { id } = req.params;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ApiError("Invalid ID format", 400));
  }

  const policy = await OvertimePolicy.findOneAndDelete({
    _id: id,
    companyId,
  });

  if (!policy) {
    return next(new ApiError(`No policy found with ID: ${id}`, 404));
  }

  res.status(200).json({
    status: "success",
    message: "Policy deleted successfully",
  });
});
