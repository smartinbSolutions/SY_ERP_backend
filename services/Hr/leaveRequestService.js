const LeaveRequest = require("../../models/Hr/leaveRequestModel");
const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const leavesLogsModel = require("../../models/Hr/leavesLogsModel");
const multer = require("multer");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const multerStorage = multer.memoryStorage();

const attachmentFilter = function (req, file, cb) {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError("File type not allowed", 400), false);
  }
};

const uploadAttachment = multer({
  storage: multerStorage,
  fileFilter: attachmentFilter,
});
exports.uploadLeaveAttachment = uploadAttachment.single("attachment");

exports.processLeaveAttachment = asyncHandler(async (req, res, next) => {
  if (!req.file) return next();

  const ext = path.extname(req.file.originalname);
  const filename = `leave-${uuidv4()}-${Date.now()}${ext}`;

  await fs.promises.writeFile(
    `uploads/leaveAttachments/${filename}`,
    req.file.buffer,
  );

  req.body.attachment = filename;

  next();
});

exports.createLeaveRequest = asyncHandler(async (req, res) => {
  const { leaveType, startDate, endDate, reason, attachment, managerId } =
    req.body;

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
    managerId,
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
/* ================= GET ALL COMPANY REQUESTS (ADMIN OR MANAGER) ================= */
exports.getAllLeaveRequests = asyncHandler(async (req, res) => {
  const { companyId, managerId } = req.query;

  if (!companyId) {
    return res
      .status(400)
      .json({ status: false, message: "companyId is required" });
  }

  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * pageSize;

  const filter = { companyId };
  if (managerId) 
    {filter.managerId = managerId;}

  const totalItems = await LeaveRequest.countDocuments(filter);
  const totalPages = Math.ceil(totalItems / pageSize);

  const requests = await LeaveRequest.find(filter)
    .populate("leaveType")
    .populate("userId", "fullName email")
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
  const request = await LeaveRequest.findById(req.params.id);
  // .populate("userId", "name email")
  // .populate("leaveType");

  if (!request) return next(new ApiError("Leave request not found", 404));

  res.status(200).json({ status: true, data: request });
});

/* ================= UPDATE REQUEST ================= */
exports.updateLeaveRequest = asyncHandler(async (req, res, next) => {
  const request = await LeaveRequest.findById(req.params.id);

  if (!request) return next(new ApiError("Leave request not found", 404));

  if (request.status !== "pending")
    return next(new ApiError("Cannot edit a processed request", 400));

  const { leaveType, startDate, endDate, reason, attachment, status } =
    req.body;

  request.leaveType = leaveType || request.leaveType;
  request.startDate = startDate || request.startDate;
  request.endDate = endDate || request.endDate;
  request.reason = reason || request.reason;
  request.attachment = attachment || request.attachment;

  if (
    status &&
    ["pending", "approved", "rejected"].includes(status.toLowerCase())
  ) {
    request.status = status.toLowerCase();
  }

  await request.save();

  res.status(200).json({ status: true, data: request });
});

exports.handleLeaveRequest = asyncHandler(async (req, res, next) => {
  const { action, reason } = req.body;

  const request = await LeaveRequest.findById(req.params.id);

  if (!request) return next(new ApiError("Leave request not found", 404));

  console.log(request.status);

  if (request.status !== "pending")
    return next(new ApiError("Already processed", 400));

  // Only manager can handle
  if (req.user._id.toString() !== request.managerId.toString()) {
    return next(new ApiError("Not authorized", 403));
  }

  if (action === "approve") {
    await leavesLogsModel.create({
      userId: request.userId,
      leaveRequestId: request._id,
      leaveType: request.leaveType,
      startDate: request.startDate,
      endDate: request.endDate,
      days: request.days,
      approvedBy: req.user._id,
      companyId: request.companyId,
    });

    request.status = "approved";
    request.approvedAt = Date.now();
  } else if (action === "reject") {
    request.status = "rejected";
    request.rejectionReason = reason || "";
    request.rejectedAt = Date.now();
  } else {
    return next(new ApiError("Invalid action", 400));
  }

  await request.save();

  res.status(200).json({
    status: true,
    message: `Leave ${action} successfully`,
    data: request,
  });
});

/* ================= DELETE REQUEST ================= */
exports.deleteLeaveRequest = asyncHandler(async (req, res, next) => {
  const request = await LeaveRequest.findById(req.params.id);

  if (!request) return next(new ApiError("Leave request not found", 404));

  // Only owner can delete before approval
  // if (request.userId.toString() !== req.user._id.toString())
  //   return next(new ApiError("Unauthorized", 403));

  // if (request.status !== "Pending")
  //   return next(new ApiError("Cannot delete a processed request", 400));

  await LeaveRequest.deleteOne({ _id: request._id });

  res.status(200).json({ status: true, message: "Leave request deleted" });
});
