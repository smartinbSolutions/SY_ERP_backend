const ApiError = require("../../../utils/apiError");
const leavesModel = require("../../../models/Hr/Leaves/leaveTypesModel");
const mongoose = require("mongoose");

// GET ALL
exports.getAllLeaves = async (req) => {
  const { policyId } = req.query;
  const companyId = req.companyId;

  if (!companyId) {
    throw new ApiError("companyId is required", 400);
  }

  const query = { companyId };

  if (policyId) {
    if (!mongoose.Types.ObjectId.isValid(policyId)) {
      throw new ApiError("Invalid policyId format", 400);
    }

    query.policyId = policyId;
  }

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const total = await leavesModel.countDocuments(query);

  const leaves = await leavesModel
    .find(query)
    .skip(skip)
    .limit(limit)
    .populate("policyId")
    .populate({
      path: "approvalFlow",
      select: "name steps createdBy",
    })
    .sort({ createdAt: -1 });

  return {
    status: "success",
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results: leaves.length,
    data: leaves,
  };
};

// GET ONE
exports.getOneLeave = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) {
    throw new ApiError("companyId is required", 400);
  }

  const leave = await leavesModel.findOne({
    _id: id,
    companyId,
  });

  if (!leave) {
    throw new ApiError(`No leave found with this ID: ${id}`, 404);
  }

  return leave;
};

// CREATE
exports.createLeave = async (req) => {
  const companyId = req.companyId;

  if (!companyId) {
    throw new ApiError("companyId is required", 400);
  }

  const leave = await leavesModel.create({
    ...req.body,
    companyId,
  });

  return leave;
};

// UPDATE
exports.updateLeave = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) {
    throw new ApiError("companyId is required", 400);
  }

  const leave = await leavesModel.findOneAndUpdate(
    { _id: id, companyId },
    { ...req.body, companyId },
    { new: true, runValidators: true },
  );

  if (!leave) {
    throw new ApiError(`No leave found with this ID: ${id}`, 404);
  }

  return leave;
};

// DELETE
exports.deleteLeave = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) {
    throw new ApiError("companyId is required", 400);
  }

  const leave = await leavesModel.findOneAndDelete({
    _id: id,
    companyId,
  });

  if (!leave) {
    throw new ApiError(`No leave found with this ID: ${id}`, 404);
  }

  return "Leave deleted successfully";
};
