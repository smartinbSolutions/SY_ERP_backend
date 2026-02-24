const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const leavesPolicyModel = require("../../models/Hr/leavesPolicyModel");
const leavesModel = require("../../models/Hr/leavesModel");

// @desc    Get all leave policies
// @route   GET /api/leaves-policy
exports.getAllLeavePolicies = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  const query = { companyId };

  // Search by policy name
  if (req.query.keyword) {
    query.policyName = { $regex: req.query.keyword, $options: "i" };
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const total = await leavesPolicyModel.countDocuments(query);

  const policies = await leavesPolicyModel
    .find(query)
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

// @desc    Get single leave policy
// @route   GET /api/leaves-policy/:id
exports.getOneLeavePolicy = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { id } = req.params;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  const policy = await leavesPolicyModel.findOne({
    _id: id,
    companyId,
  });

  if (!policy) {
    
    return next(new ApiError(`No policy found with this ID: ${id}`, 404));
  }

  res.status(200).json({
    status: "success",
    data: policy,
  });
});

// @desc    Create leave policy
// @route   POST /api/leaves-policy
exports.createLeavePolicy = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  // Prevent duplicate policy names
  const exists = await leavesPolicyModel.findOne({
    companyId,
    policyName: req.body.policyName,
  });
  if (exists) {
    return next(new ApiError("Policy name already exists", 400));
  }

  // 1️⃣ Create the leave policy
  const policy = await leavesPolicyModel.create({
    ...req.body,
    companyId,
  });

  // 2️⃣ Create leave types if provided
  if (req.body.leaveTypes && Array.isArray(req.body.leaveTypes)) {
    const leaveDocs = req.body.leaveTypes.map((type) => ({
      policyId: policy._id,
      companyId,
      ...type, // typeId, typeKey, annualRules, sickRules, etc.
    }));

    await leavesModel.insertMany(leaveDocs);
  }

  res.status(201).json({
    status: "success",
    message: "Leave policy and leave types created successfully",
    data: {
      policy,
      leaveTypes: req.body.leaveTypes || [],
    },
  });
});

// @desc    Update leave policy
// @route   PUT /api/leaves-policy/:id
exports.updateLeavePolicy = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { id } = req.params;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  const policy = await leavesPolicyModel.findOneAndUpdate(
    { _id: id, companyId },
    { ...req.body },
    { new: true, runValidators: true },
  );

  if (!policy) {
    return next(new ApiError(`No policy found with this ID: ${id}`, 404));
  }

  res.status(200).json({
    status: "success",
    data: policy,
  });
});

// @desc    Delete leave policy
// @route   DELETE /api/leaves-policy/:id
exports.deleteLeavePolicy = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { id } = req.params;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  // حذف السياسة
  const policy = await leavesPolicyModel.findOneAndDelete({
    _id: id,
    companyId,
  });

  if (!policy) {
    return next(new ApiError(`No policy found with this ID: ${id}`, 404));
  }

  await leavesModel.deleteMany({ policyId: id });

  res.status(200).json({
    status: "success",
    message: "Leave policy and related leaves deleted successfully",
  });
});
