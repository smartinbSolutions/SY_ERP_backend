const ApiError = require("../../../utils/apiError");
const leavesPolicyModel = require("../../../models/Hr/Leaves/leavesPolicyModel");
const leavesModel = require("../../../models/Hr/Leaves/leaveTypesModel");

exports.getAllLeavePolicies = async (req) => {
  const companyId = req.companyId;

  if (!companyId) {
    throw new ApiError("companyId is required", 400);
  }

  const query = { companyId };

  if (req.query.keyword) {
    query.policyName = {
      $regex: req.query.keyword,
      $options: "i",
    };
  }

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const total = await leavesPolicyModel.countDocuments(query);

  const policies = await leavesPolicyModel
    .find(query)
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  return {
    status: "success",
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results: policies.length,
    data: policies,
  };
};

exports.getOneLeavePolicy = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) {
    throw new ApiError("companyId is required", 400);
  }

  const policy = await leavesPolicyModel
    .findOne({
      _id: id,
      companyId,
    })
    .populate({
      path: "approvalFlow",
      select: "name steps createdBy",
    });

  if (!policy) {
    throw new ApiError(`No policy found with this ID: ${id}`, 404);
  }

  return policy;
};

exports.createLeavePolicy = async (req) => {
  const companyId = req.companyId;

  if (!companyId) {
    throw new ApiError("companyId is required", 400);
  }

  const exists = await leavesPolicyModel.findOne({
    companyId,
    policyName: req.body.policyName,
  });

  if (exists) {
    throw new ApiError("Policy name already exists", 400);
  }

  const policy = await leavesPolicyModel.create({
    ...req.body,
    companyId,
  });

  if (req.body.leaveTypes && Array.isArray(req.body.leaveTypes)) {
    const leaveDocs = req.body.leaveTypes.map((type) => ({
      policyId: policy._id,
      companyId,
      ...type,
    }));

    await leavesModel.insertMany(leaveDocs);
  }

  return {
    policy,
    leaveTypes: req.body.leaveTypes || [],
  };
};

exports.updateLeavePolicy = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) {
    throw new ApiError("companyId is required", 400);
  }

  const policy = await leavesPolicyModel.findOneAndUpdate(
    { _id: id, companyId },
    { ...req.body },
    { new: true, runValidators: true },
  );

  if (!policy) {
    throw new ApiError(`No policy found with this ID: ${id}`, 404);
  }

  return policy;
};

exports.deleteLeavePolicy = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) {
    throw new ApiError("companyId is required", 400);
  }

  const policy = await leavesPolicyModel.findOneAndDelete({
    _id: id,
    companyId,
  });

  if (!policy) {
    throw new ApiError(`No policy found with this ID: ${id}`, 404);
  }

  await leavesModel.deleteMany({ policyId: id });

  return "Leave policy and related leaves deleted successfully";
};
