const asyncHandler = require("express-async-handler");
const leavePolicyService = require("../../../services/Hr/Leaves/leavesPolicy.service");

// GET ALL
exports.getAllLeavePolicies = asyncHandler(async (req, res, next) => {
  const result = await leavePolicyService.getAllLeavePolicies(req);

  res.status(200).json(result);
});

// GET ONE
exports.getOneLeavePolicy = asyncHandler(async (req, res, next) => {
  const policy = await leavePolicyService.getOneLeavePolicy(req);

  res.status(200).json({
    status: "success",
    data: policy,
  });
});

// CREATE
exports.createLeavePolicy = asyncHandler(async (req, res, next) => {
  const result = await leavePolicyService.createLeavePolicy(req);

  res.status(201).json({
    status: "success",
    message: "Leave policy and leave types created successfully",
    data: result,
  });
});

// UPDATE
exports.updateLeavePolicy = asyncHandler(async (req, res, next) => {
  const policy = await leavePolicyService.updateLeavePolicy(req);

  res.status(200).json({
    status: "success",
    data: policy,
  });
});

// DELETE
exports.deleteLeavePolicy = asyncHandler(async (req, res, next) => {
  const result = await leavePolicyService.deleteLeavePolicy(req);

  res.status(200).json({
    status: "success",
    message: result,
  });
});
