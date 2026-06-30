const asyncHandler = require("express-async-handler");
const ApiError = require("../../../utils/apiError");
const DeductionType = require("../../../models/Hr/Deductions/deductionTypesModel");
const mongoose = require("mongoose");

/* =====================================================
   GET ALL
===================================================== */
exports.getAllDeductionTypes = asyncHandler(async (req, res, next) => {
  const { policyId } = req.query;
  const companyId = req.companyId;

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

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;


  const total = await DeductionType.countDocuments(query);

  const data = await DeductionType.find(query)
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: "success",
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results: data.length,
    data,
  });
});

/* =====================================================
   GET ONE
===================================================== */
exports.getOneDeductionType = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ApiError("Invalid ID format", 400));
  }

  const doc = await DeductionType.findOne({ _id: id, companyId });

  if (!doc) {
    return next(new ApiError("Deduction type not found", 404));
  }

  res.status(200).json({
    status: "success",
    data: doc,
  });
});

/* =====================================================
   CREATE
===================================================== */
exports.createDeductionType = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  const { policyId, violationType, stages } = req.body;

  if (!violationType || !stages) {
    return next(new ApiError("violationType and stages are required", 400));
  }

  const doc = await DeductionType.create({
    policyId,
    violationType,
    stages,
    companyId,
  });

  res.status(201).json({
    status: "success",
    message: "Deduction policy created",
    data: doc,
  });
});

/* =====================================================
   UPDATE
===================================================== */
exports.updateDeductionType = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ApiError("Invalid ID format", 400));
  }

  const { violationType, stages } = req.body;

  const updates = {};
  if (violationType) updates.violationType = violationType;
  if (stages) updates.stages = stages;

  const doc = await DeductionType.findOneAndUpdate(
    { _id: id, companyId },
    updates,
    { new: true, runValidators: true },
  );

  if (!doc) {
    return next(new ApiError("Deduction type not found", 404));
  }

  res.status(200).json({
    status: "success",
    data: doc,
  });
});

/* =====================================================
   DELETE
===================================================== */
exports.deleteDeductionType = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ApiError("Invalid ID format", 400));
  }

  const doc = await DeductionType.findOneAndDelete({
    _id: id,
    companyId,
  });

  if (!doc) {
    return next(new ApiError("Deduction type not found", 404));
  }

  res.status(200).json({
    status: "success",
    message: "Deleted successfully",
  });
});
