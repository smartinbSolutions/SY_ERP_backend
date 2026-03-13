const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const AdvancePolicy = require("../../models/Hr/advancePolicyModel");
const AdvanceType = require("../../models/Hr/advanceTypesModel");
const mongoose = require("mongoose");

// @desc    Get all advance policies
// @route   GET /api/advance-policies
exports.getAllPolicies = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;

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
  const total = await AdvancePolicy.countDocuments(query);

  const policies = await AdvancePolicy.find(query)
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

// @desc    Get single advance policy
// @route   GET /api/advance-policies/:id
exports.getOnePolicy = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { id } = req.params;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ApiError("Invalid ID format", 400));
  }

  const policy = await AdvancePolicy.findOne({ _id: id, companyId });

  if (!policy) {
    return next(new ApiError(`No policy found with ID: ${id}`, 404));
  }

  res.status(200).json({
    status: "success",
    data: policy,
  });
});

// @desc    Create advance policy
// @route   POST /api/advance-policies

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

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const exists = await AdvancePolicy.findOne({
      companyId,
      policyName,
    }).session(session);

    if (exists) {
      throw new ApiError("Policy name already exists", 400);
    }

    const policy = await AdvancePolicy.create(
      [
        {
          policyName,
          code,
          companyId,
          approvalFlow,
        },
      ],
      { session },
    );

    let createdTypes = [];

    if (types && Array.isArray(types) && types.length > 0) {
      const docs = types.map((type) => ({
        policyId: policy[0]._id,
        companyId,

        typeKey: type.typeKey,
        maxPercentageOfSalary: type.maxPercentageOfSalary,
        approvalFlow: type.approvalFlow,
        requiresAttachment: type.requiresAttachment ?? false,
        allowInstallments: type.allowInstallments ?? false,
        maxMonthsInstallments: type.maxMonthsInstallments ?? null,
        maxInstallmentPercentage: type.maxInstallmentPercentage ?? 1,
        minMonthsAfterJoin: type.minMonthsAfterJoin ?? 3,
      }));

      createdTypes = await AdvanceType.insertMany(docs, {
        session,
      });
    }

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      status: "success",
      data: {
        policy: policy[0],
        types: createdTypes,
      },
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    return next(err);
  }
});

// @desc    Update advance policy
// @route   PATCH /api/advance-policies/:id
exports.updatePolicy = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { id } = req.params;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ApiError("Invalid ID format", 400));
  }

  if (req.body.policyName) {
    const exists = await AdvancePolicy.findOne({
      companyId,
      policyName: req.body.policyName,
      _id: { $ne: id },
    });
    if (exists) throw new ApiError("Policy name already exists", 400);
  }

  const updateData = {};

  if (req.body.policyName !== undefined)
    updateData.policyName = req.body.policyName;

  if (req.body.code !== undefined) updateData.code = req.body.code;

  const policy = await AdvancePolicy.findOneAndUpdate(
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

// @desc    Delete advance policy
// @route   DELETE /api/advance-policies/:id
exports.deletePolicy = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { id } = req.params;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ApiError("Invalid ID format", 400));
  }

  const policy = await AdvancePolicy.findOneAndDelete({
    _id: id,
    companyId,
  });

  if (!policy) {
    return next(new ApiError(`No policy found with ID: ${id}`, 404));
  }

  // optional: delete related advance types
  await AdvanceType.deleteMany({ policyId: id });

  res.status(200).json({
    status: "success",
    message: "Advance policy and related types deleted successfully",
  });
});
