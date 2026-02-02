// services/Hr/leaveRequestService.js

const LeaveRequest = require("../../models/Hr/leaveRequestModel");
const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");

/* ================= CREATE ================= */
exports.createLeaveRequest = asyncHandler(async (req, res) => {
  const { leaveType, startDate, endDate, reason, attachment } = req.body;

  // تأكد من وجود user في req (middleware auth لازم يحط req.user)
  if (!req.user) {
    return res.status(401).json({ status: "fail", message: "Not logged in" });
  }

  const newRequest = await LeaveRequest.create({
    userId: req.user._id,           
    companyId: req.user.companyId,  
    leaveType,
    startDate,
    endDate,
    reason,
    attachment: attachment || null,
  });

  res.status(201).json({
    status: true,
    data: newRequest,
    message: "Leave request submitted successfully",
  });
});


/* ================= GET MY REQUESTS ================= */
exports.getMyLeaveRequests = asyncHandler(async (req, res) => {
  const requests = await LeaveRequest.find({ userId: req.user._id }).populate(
    "leaveType",
  );
  res.status(200).json({ status: true, data: requests });
});

/* ================= GET ALL COMPANY REQUESTS (ADMIN) ================= */
exports.getAllLeaveRequests = asyncHandler(async (req, res) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ status: false, message: "companyId is required" });
  }

  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.limit) || 20; // لو موجود limit من query رح يستخدمه، وإلا 20
  const skip = (page - 1) * pageSize;

  const totalItems = await LeaveRequest.countDocuments({ companyId });
  const totalPages = Math.ceil(totalItems / pageSize);

  const requests = await LeaveRequest.find({ companyId })
    .populate("leaveType")
    .skip(skip)
    .limit(pageSize)
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: true,
    page,
    totalPages,
    results: requests.length,
    totalItems,
    data: requests,
  });
});



/* ================= GET ONE REQUEST ================= */
exports.getLeaveRequestById = asyncHandler(async (req, res, next) => {
  const request = await LeaveRequest.findById(req.params.id)
    // .populate("userId", "name email")
    // .populate("leaveType");

  if (!request) return next(new ApiError("Leave request not found", 404));

  res.status(200).json({ status: true, data: request });
});

/* ================= UPDATE REQUEST ================= */
exports.updateLeaveRequest = asyncHandler(async (req, res, next) => {
  const request = await LeaveRequest.findById(req.params.id);

  if (!request) return next(new ApiError("Leave request not found", 404));

  // Allow only owner to edit before approval
  if (request.userId.toString() !== req.user._id.toString())
    return next(new ApiError("Unauthorized", 403));

  if (request.status !== "Pending")
    return next(new ApiError("Cannot edit a processed request", 400));

  const { leaveType, startDate, endDate, reason, attachment } = req.body;

  request.leaveType = leaveType || request.leaveType;
  request.startDate = startDate || request.startDate;
  request.endDate = endDate || request.endDate;
  request.reason = reason || request.reason;
  request.attachment = attachment || request.attachment;

  await request.save();

  res.status(200).json({ status: true, data: request });
});

/* ================= DELETE REQUEST ================= */
exports.deleteLeaveRequest = asyncHandler(async (req, res, next) => {
  const request = await LeaveRequest.findById(req.params.id);

  if (!request) return next(new ApiError("Leave request not found", 404));

  // Only owner can delete before approval
  if (request.userId.toString() !== req.user._id.toString())
    return next(new ApiError("Unauthorized", 403));

  if (request.status !== "Pending")
    return next(new ApiError("Cannot delete a processed request", 400));

  await LeaveRequest.deleteOne({ _id: request._id });

  res.status(200).json({ status: true, message: "Leave request deleted" });
});


/* ================= ADMIN: CHANGE STATUS ================= */
exports.changeLeaveRequestStatus = asyncHandler(async (req, res, next) => {
  const { status } = req.body; // "Approved" or "Rejected"

  const request = await LeaveRequest.findById(req.params.id);

  if (!request) return next(new ApiError("Leave request not found", 404));

  request.status = status;
  await request.save();

  res
    .status(200)
    .json({ status: true, data: request, message: `Request ${status}` });
});
