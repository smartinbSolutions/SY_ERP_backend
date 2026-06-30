const asyncHandler = require("express-async-handler");
const ApiError = require("../../../utils/apiError");
const DeductionPolicy = require("../../../models/Hr/Deductions/deductionPolicyModel");
const DeductionType = require("../../../models/Hr/Deductions/deductionTypesModel");
const mongoose = require("mongoose");

// @desc    Get all deduction policies
// @route   GET /api/deduction-policies
exports.getAllPolicies = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;
  const keyword = req.query.keyword;

  const query = { companyId };

  if (keyword) {
    query.$or = [{ policyName: { $regex: keyword, $options: "i" } }];
  }

  const total = await DeductionPolicy.countDocuments(query);

  const policies = await DeductionPolicy.find(query)
    .skip(skip)
    .limit(limit)
    .populate({
      path: "approvalFlow",
      select: "name steps createdBy",
    })
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

// @desc    Get single deduction policy
// @route   GET /api/deduction-policies/:id
exports.getOnePolicy = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ApiError("Invalid ID format", 400));
  }

  const policy = await DeductionPolicy.findOne({
    _id: id,
    companyId,
  }).populate({
    path: "approvalFlow",
    select: "name steps createdBy",
  });

  if (!policy) {
    return next(new ApiError(`No policy found with ID: ${id}`, 404));
  }

  res.status(200).json({
    status: "success",
    data: policy,
  });
});

// @desc    Create deduction policy + types
// @route   POST /api/deduction-policies
exports.createPolicy = asyncHandler(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const companyId = req.companyId;
    const { policyName, code, approvalFlow, types } = req.body;

    // 🔴 validations
    if (!companyId) {
      throw new ApiError("companyId is required", 400);
    }

    if (!policyName) {
      throw new ApiError("policyName is required", 400);
    }

    // 🔍 check if exists
    const exists = await DeductionPolicy.findOne({
      companyId,
      policyName,
    }).session(session);

    if (exists) {
      throw new ApiError("Policy name already exists", 400);
    }

    // 🟢 create policy
    const [policy] = await DeductionPolicy.create(
      [
        {
          policyName,
          code,
          approvalFlow,
          companyId,
        },
      ],
      { session },
    );

    let createdTypes = [];

    if (types && Array.isArray(types) && types.length > 0) {
      const docs = types.map((type) => ({
        ...type,
        companyId,
        policyId: policy._id,
      }));

      createdTypes = await DeductionType.insertMany(docs, {
        session,
      });
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      status: "success",
      message: "Deduction policy created successfully",
      data: {
        policy,
        types: createdTypes,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    return next(error);
  }
});

// @desc    Update deduction policy
// @route   PATCH /api/deduction-policies/:id
exports.updatePolicy = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
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

  const policy = await DeductionPolicy.findOneAndUpdate(
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

// @desc    Delete deduction policy
// @route   DELETE /api/deduction-policies/:id
exports.deletePolicy = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ApiError("Invalid ID format", 400));
  }

  const policy = await DeductionPolicy.findOneAndDelete({
    _id: id,
    companyId,
  });

  if (!policy) {
    return next(new ApiError(`No policy found with ID: ${id}`, 404));
  }

  // delete all related types
  await DeductionType.deleteMany({ policyId: id });

  res.status(200).json({
    status: "success",
    message: "Deduction policy deleted successfully",
  });
});
