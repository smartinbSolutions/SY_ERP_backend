const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const mongoose = require("mongoose");
const service = require("../../services/Hr/advanceTypesService");

// ================= CREATE =================
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

  const existing = await service.findOneType({ policyId, typeKey, companyId });
  if (existing)
    return next(
      new ApiError("This advance type already exists for this policy", 400),
    );

  const newAdvanceType = await service.createAdvanceType({
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

  res.status(201).json({ status: "success", data: newAdvanceType });
});

// ================= GET ALL =================
exports.getAllAdvanceTypes = asyncHandler(async (req, res, next) => {
  const { companyId, policyId } = req.query;
  if (!companyId) return next(new ApiError("companyId is required", 400));

  const query = { companyId };
  if (policyId) {
    if (!mongoose.Types.ObjectId.isValid(policyId))
      return next(new ApiError("Invalid policyId format", 400));
    query.policyId = policyId;
  }

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const total = await service.countTypes(query);
  const advanceTypes = await service.findTypes(query, skip, limit);

  res.status(200).json({
    status: "success",
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results: advanceTypes.length,
    data: advanceTypes,
  });
});

// ================= GET ONE =================
exports.getOneAdvanceType = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { id } = req.params;

  if (!companyId) return next(new ApiError("companyId is required", 400));
  if (!mongoose.Types.ObjectId.isValid(id))
    return next(new ApiError("Invalid ID format", 400));

  const advanceType = await service.findByIdAndCompany(id, companyId);
  if (!advanceType)
    return next(new ApiError(`No advance type found with ID: ${id}`, 404));

  res.status(200).json({ status: "success", data: advanceType });
});

// ================= UPDATE =================
exports.updateAdvanceType = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { id } = req.params;

  if (!companyId) return next(new ApiError("companyId is required", 400));
  if (!mongoose.Types.ObjectId.isValid(id))
    return next(new ApiError("Invalid ID format", 400));

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
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  try {
    const advanceType = await service.updateByIdAndCompany(
      id,
      companyId,
      updates,
    );
    if (!advanceType)
      return next(new ApiError(`No advance type found with ID: ${id}`, 404));

    res.status(200).json({ status: "success", data: advanceType });
  } catch (err) {
    console.error("Update AdvanceType Error:", err);
    next(err);
  }
});

// ================= DELETE =================
exports.deleteAdvanceType = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { id } = req.params;

  if (!companyId) return next(new ApiError("companyId is required", 400));
  if (!mongoose.Types.ObjectId.isValid(id))
    return next(new ApiError("Invalid ID format", 400));

  const advanceType = await service.deleteByIdAndCompany(id, companyId);
  if (!advanceType)
    return next(new ApiError(`No advance type found with ID: ${id}`, 404));

  res
    .status(200)
    .json({ status: "success", message: "Advance type deleted successfully" });
});
