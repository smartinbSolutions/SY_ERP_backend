const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const leavesModel = require("../../models/Hr/leavesModel");
const { default: mongoose } = require("mongoose");

// @desc    Get all leaves
// @route   GET /api/leaves
exports.getAllLeaves = asyncHandler(async (req, res, next) => {
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

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const total = await leavesModel.countDocuments(query);

  const leaves = await leavesModel
    .find(query)
    .skip(skip)
    .limit(limit)
    .populate("policyId")
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: "success",
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results: leaves.length,
    data: leaves,
  });
});

// @desc    Get single leave
// @route   GET /api/leaves/:id
exports.getOneLeave = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { id } = req.params;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  const leave = await leavesModel.findOne({ _id: id, companyId });

  if (!leave) {
    return next(new ApiError(`No leave found with this ID: ${id}`, 404));
  }

  res.status(200).json({
    status: "success",
    data: leave,
  });
});

// @desc    Create leave
// @route   POST /api/leaves
exports.createLeave = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  const leave = await leavesModel.create({
    ...req.body,
    companyId,
  });

  res.status(201).json({
    status: "success",
    data: leave,
  });
});

// @desc    Update leave
// @route   PUT /api/leaves/:id
exports.updateLeave = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { id } = req.params;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  const leave = await leavesModel.findOneAndUpdate(
    { _id: id, companyId },
    { ...req.body, companyId },
    { new: true, runValidators: true },
  );

  if (!leave) {
    return next(new ApiError(`No leave found with this ID: ${id}`, 404));
  }

  res.status(200).json({
    status: "success",
    data: leave,
  });
});

// @desc    Delete leave
// @route   DELETE /api/leaves/:id
exports.deleteLeave = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { id } = req.params;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  const leave = await leavesModel.findOneAndDelete({
    _id: id,
    companyId,
  });

  if (!leave) {
    return next(new ApiError(`No leave found with this ID: ${id}`, 404));
  }

  res.status(200).json({
    status: "success",
    message: "Leave deleted successfully",
  });
});
