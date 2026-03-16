const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const AdvanceType = require("../../models/Hr/advanceTypesModel");
const AdvancePolicy = require("../../models/Hr/advancePolicyModel");

const { default: mongoose } = require("mongoose");

exports.createAdvanceType = asyncHandler(async (req, res, next) => {
  const {
    policyId,
    typeKey,
    approvalFlow,
    maxPercentageOfSalary,
    minMonthsAfterJoin,
    requiresAttachment,
    allowInstallments,
    maxMonthsInstallments,
    maxInstallmentPercentage,
  } = req.body;
  const companyId = req.query.companyId;

  if (!companyId) return next(new ApiError("companyId is required", 400));
  if (!policyId) return next(new ApiError("policyId is required", 400));
  if (!typeKey) return next(new ApiError("typeKey is required", 400));

  const existing = await AdvanceType.findOne({ policyId, typeKey, companyId });
  if (existing)
    return next(
      new ApiError("This advance type already exists for this policy", 400),
    );

  const newAdvanceType = await AdvanceType.create({
    policyId,
    companyId,
    typeKey,
    approvalFlow: approvalFlow || null,
    maxPercentageOfSalary,
    minMonthsAfterJoin,
    requiresAttachment,
    allowInstallments,
    maxMonthsInstallments,
    maxInstallmentPercentage,
  });

  res.status(201).json({
    status: "success",
    data: newAdvanceType,
  });
});
// @desc    Get all advance types
// @route   GET /api/advance-types
exports.getAllAdvanceTypes = asyncHandler(async (req, res, next) => {
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

  const total = await AdvanceType.countDocuments(query);

  const advanceTypes = await AdvanceType.find(query)
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
    results: advanceTypes.length,
    data: advanceTypes,
  });
});

// @desc    Get single advance type
// @route   GET /api/advance-types/:id
exports.getOneAdvanceType = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { id } = req.params;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ApiError("Invalid ID format", 400));
  }

  const advanceType = await AdvanceType.findOne({
    _id: id,
    companyId,
  });

  if (!advanceType) {
    return next(new ApiError(`No advance type found with ID: ${id}`, 404));
  }

  res.status(200).json({
    status: "success",
    data: advanceType,
  });
});

// @desc    Update advance type
// @route   PATCH /api/advance-types/:id
exports.updateAdvanceType = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { id } = req.params;

  console.log("PATCH Request Body:", req.body);

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ApiError("Invalid ID format", 400));
  }

  const allowedUpdates = [
    "allowInstallments",
    "maxMonthsInstallments",
    "maxInstallmentPercentage",
    "minMonthsAfterJoin",
    "requiresAttachment",
    "requiresApproval",
    "maxPercentageOfSalary",
    "approvalFlow",
  ];

  const updates = {};
  allowedUpdates.forEach((field) => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });

  try {
    const advanceType = await AdvanceType.findOneAndUpdate(
      { _id: id, companyId },
      updates,
      { new: true, runValidators: true },
    );

    if (!advanceType) {
      return next(new ApiError(`No advance type found with ID: ${id}`, 404));
    }

    res.status(200).json({ status: "success", data: advanceType });
  } catch (err) {
    console.error("Update AdvanceType Error:", err); // <--- سجل الخطأ الكامل
    next(err);
  }
});

// @desc    Delete advance type
// @route   DELETE /api/advance-types/:id
exports.deleteAdvanceType = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { id } = req.params;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ApiError("Invalid ID format", 400));
  }

  const advanceType = await AdvanceType.findOneAndDelete({
    _id: id,
    companyId,
  });

  if (!advanceType) {
    return next(new ApiError(`No advance type found with ID: ${id}`, 404));
  }

  res.status(200).json({
    status: "success",
    message: "Advance type deleted successfully",
  });
});
