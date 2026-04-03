const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const DeductionType = require("../../models/Hr/deductionTypesModel");
const { default: mongoose } = require("mongoose");

// @desc    Get all deduction types
// @route   GET /api/deduction-types
exports.getAllDeductionTypes = asyncHandler(async (req, res, next) => {
  const { companyId, policyId } = req.query;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  const query = { companyId };

  if (policyId) {
    if (!mongoose.Types.ObjectId.isValid(policyId)) {
      return next(new ApiError("Invalid policyId format", 400));
    }

    query.policyId = policyId;
  }

  // pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const total = await DeductionType.countDocuments(query);

  const deductionTypes = await DeductionType.find(query)
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: "success",
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results: deductionTypes.length,
    data: deductionTypes,
  });
});

// @desc    Get single deduction type
// @route   GET /api/deduction-types/:id
exports.getOneDeductionType = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { id } = req.params;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ApiError("Invalid ID format", 400));
  }

  const deductionType = await DeductionType.findOne({
    _id: id,
    companyId,
  });

  if (!deductionType) {
    return next(new ApiError(`No deduction type found with ID: ${id}`, 404));
  }

  res.status(200).json({
    status: "success",
    data: deductionType,
  });
});

// @desc    Create deduction type
// @route   POST /api/deduction-types
exports.createDeductionType = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  const {
    policyId,
    violationType,
    occurrence,
    actionType,
    deductionUnit,
    deductionValue,
    escalateToHR,
  } = req.body;

  const deductionType = await DeductionType.create({
    policyId,
    violationType,
    occurrence,
    actionType,
    deductionUnit,
    deductionValue,
    escalateToHR,

    companyId,
  });

  res.status(201).json({
    status: "deduction type created successfully",
    data: deductionType,
  });
});

// @desc    Update deduction type
// @route   PATCH /api/deduction-types/:id
exports.updateDeductionType = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { id } = req.params;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ApiError("Invalid ID format", 400));
  }

  const allowedUpdates = [
    "occurrence",
    "actionType",
    "deductionUnit",
    "deductionValue",
    "escalateToHR",
    "requiresApproval",
    "approvalFlow",
  ];

  const updates = {};

  allowedUpdates.forEach((field) => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });

  const deductionType = await DeductionType.findOneAndUpdate(
    { _id: id, companyId },
    updates,
    {
      new: true,
      runValidators: true,
    },
  );

  if (!deductionType) {
    return next(new ApiError(`No deduction type found with ID: ${id}`, 404));
  }

  res.status(200).json({
    status: "success",
    data: deductionType,
  });
});

// @desc    Delete deduction type
// @route   DELETE /api/deduction-types/:id
exports.deleteDeductionType = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { id } = req.params;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ApiError("Invalid ID format", 400));
  }

  const deductionType = await DeductionType.findOneAndDelete({
    _id: id,
    companyId,
  });

  if (!deductionType) {
    return next(new ApiError(`No deduction type found with ID: ${id}`, 404));
  }

  res.status(200).json({
    status: "success",
    message: "Deduction type deleted successfully",
  });
});
