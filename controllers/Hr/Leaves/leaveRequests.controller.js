const asyncHandler = require("express-async-handler");
const leaveRequestService = require("../../../services/Hr/Leaves/leaveRequest.service");

exports.createLeaveRequest = asyncHandler(async (req, res, next) => {
  const newRequest = await leaveRequestService.createLeaveRequest(req);

  res.status(201).json({
    status: true,
    data: newRequest,
    message: "Leave request submitted successfully",
  });
});

exports.getMyLeaveRequests = asyncHandler(async (req, res) => {
  const result = await leaveRequestService.getMyLeaveRequests(req);

  res.status(200).json(result);
});

exports.getAllLeaveRequests = asyncHandler(async (req, res) => {
  const result = await leaveRequestService.getAllLeaveRequests(req);

  res.status(200).json(result);
});

exports.getLeaveRequestById = asyncHandler(async (req, res, next) => {
  const request = await leaveRequestService.getLeaveRequestById(req.params.id);

  res.status(200).json({
    status: true,
    data: request,
  });
});

exports.getMyApprovals = asyncHandler(async (req, res) => {
  const result = await leaveRequestService.getMyApprovals(req);

  res.status(200).json(result);
});

exports.updateLeaveRequest = asyncHandler(async (req, res, next) => {
  const request = await leaveRequestService.updateLeaveRequest(
    req.params.id,
    req.body,
  );

  res.status(200).json({
    status: true,
    data: request,
  });
});

exports.handleLeaveRequest = asyncHandler(async (req, res, next) => {
  const updatedRequest = await leaveRequestService.handleLeaveRequest(req);

  res.status(200).json({
    status: true,
    message: `Leave request ${req.body.action} successfully`,
    data: updatedRequest,
  });
});

exports.deleteLeaveRequest = asyncHandler(async (req, res, next) => {
  await leaveRequestService.deleteLeaveRequest(req.params.id);

  res.status(200).json({
    status: true,
    message: "Leave request deleted",
  });
});

exports.processLeaveAttachment = leaveRequestService.processLeaveAttachment;

exports.uploadLeaveAttachment = leaveRequestService.uploadLeaveAttachment;
