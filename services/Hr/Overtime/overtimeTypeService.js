const asyncHandler = require("express-async-handler");
const ApiError = require("../../../utils/apiError");
const OvertimeType = require("../../../models/Hr/Overtime/overtimeTypesModel");
const { default: mongoose } = require("mongoose");

// @desc    Get all overtime types
// @route   GET /api/overtime-types
exports.getAllOvertimeTypes = asyncHandler(async (req, res, next) => {
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

  const total = await OvertimeType.countDocuments(query);

  const overtimeTypes = await OvertimeType.find(query)
    .skip(skip)
    .limit(limit)
    .populate({
      path: "approvalFlow",
      select: "name steps createdBy",
    })
    // .populate("policyId")
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: "success",
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results: overtimeTypes.length,
    data: overtimeTypes,
  });
});

// @desc    Get single overtime type
// @route   GET /api/overtime-types/:id
exports.getOneOvertimeType = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { id } = req.params;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ApiError("Invalid ID format", 400));
  }

  const overtimeType = await OvertimeType.findOne({
    _id: id,
    companyId,
  });
  //   .populate("policyId");

  if (!overtimeType) {
    return next(new ApiError(`No overtime type found with ID: ${id}`, 404));
  }

  res.status(200).json({
    status: "success",
    data: overtimeType,
  });
});

// @desc    Create overtime type
// @route   POST /api/overtime-types
exports.createOvertimeType = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  const {
    policyId,
    typeKey,
    rateMultiplier,
    weeklyLimit,
    dailyLimit,
    givesLeaveBalance,
    leaveMultiplier,
    requiresAttachment,
    applicableDayType,
    approvalFlow
  } = req.body;

  const overtimeType = await OvertimeType.create({
    policyId,
    typeKey,
    rateMultiplier,
    weeklyLimit,
    dailyLimit,
    givesLeaveBalance,
    leaveMultiplier,
    requiresAttachment,
    applicableDayType,
    approvalFlow,
    companyId,
  });

  res.status(201).json({
    status: "overtime type created successfully",
    data: overtimeType,
  });
});

// @desc    Update overtime type
// @route   PATCH /api/overtime-types/:id
exports.updateOvertimeType = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { id } = req.params;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ApiError("Invalid ID format", 400));
  }

  const allowedUpdates = [
    "rateMultiplier",
    "weeklyLimit",
    "dailyLimit",
    "givesLeaveBalance",
    "leaveMultiplier",
    "requiresAttachment",
    "applicableDayType",
    "approvalFlow",
  ];

  const updates = {};

  allowedUpdates.forEach((field) => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });

  const overtimeType = await OvertimeType.findOneAndUpdate(
    { _id: id, companyId },
    updates,
    {
      new: true,
      runValidators: true,
    },
  );

  if (!overtimeType) {
    return next(new ApiError(`No overtime type found with ID: ${id}`, 404));
  }

  res.status(200).json({
    status: "success",
    data: overtimeType,
  });
});

// @desc    Delete overtime type
// @route   DELETE /api/overtime-types/:id
exports.deleteOvertimeType = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { id } = req.params;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ApiError("Invalid ID format", 400));
  }

  const overtimeType = await OvertimeType.findOneAndDelete({
    _id: id,
    companyId,
  });

  if (!overtimeType) {
    return next(new ApiError(`No overtime type found with ID: ${id}`, 404));
  }

  res.status(200).json({
    status: "success",
    message: "Overtime type deleted successfully",
  });
});
