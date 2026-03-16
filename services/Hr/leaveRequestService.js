const LeaveRequest = require("../../models/Hr/leaveRequestModel");
const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const leavesLogsModel = require("../../models/Hr/leavesLogsModel");
const multer = require("multer");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const approvalFlowModel = require("../../models/Hr/approvalFlowModel");
const leavesModel = require("../../models/Hr/leavesModel");
const { handleApproval } = require("./approvalService");
const leaveRequestModel = require("../../models/Hr/leaveRequestModel");
const multerStorage = multer.memoryStorage();
const mongoose = require("mongoose");

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

exports.createLeaveRequest = asyncHandler(async (req, res, next) => {
  try {
    const {
      leaveType,
      startDate,
      endDate,
      reason,
      attachment,
      managerId,
      days,
    } = req.body;

    if (!req.user) return next(new ApiError("Not logged in", 401));

    const leave = await leavesModel
      .findById(leaveType)
      .populate("approvalFlow policyId");
    if (!leave) return next(new ApiError("Leave type not found", 404));

    const flowId = leave.approvalFlow || leave.policyId?.approvalFlow;
    if (!flowId) return next(new ApiError("Approval flow not found", 404));

    const flow = await approvalFlowModel.findById(flowId);
    if (!flow) return next(new ApiError("Approval flow not found", 404));

    let approvalSteps = [];
    let stepCounter = 1;

    if (flow.includeDirectManager && managerId) {
      approvalSteps.push({
        stepNumber: stepCounter,
        stepName: "Direct Manager Approval",
        approverId: managerId,
        status: "pending",
        actedBy: null,
        actedAt: null,
        comment: "",
      });
      stepCounter++;
    }

    flow.steps.forEach((step) => {
      approvalSteps.push({
        stepNumber: stepCounter,
        stepName: step.stepName || "",
        approverId: step.approver.employeeId,
        status: "pending",
        actedBy: null,
        actedAt: null,
        comment: "",
      });
      stepCounter++;
    });

    const newRequest = await LeaveRequest.create({
      userId: req.user._id,
      companyId: req.user.companyId,
      leaveType,
      startDate,
      endDate,
      reason,
      days,
      managerId,
      attachment: attachment || null,
      approval: {
        flowId: flow._id,
        currentStep: 1,
        currentApprover: approvalSteps[0]?.approverId || null,
        steps: approvalSteps,
      },
    });

    res.status(201).json({
      status: true,
      data: newRequest,
      message: "Leave request submitted successfully",
    });
  } catch (err) {
    console.error("Error in createLeaveRequest:", err);
    return next(err);
  }
});

/* ================= GET MY REQUESTS ================= */
exports.getMyLeaveRequests = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const filter = { userId: req.user._id };

  const totalItems = await LeaveRequest.countDocuments(filter);
  const totalPages = Math.ceil(totalItems / limit);

  const requests = await LeaveRequest.find(filter)
    .populate("leaveType")
    .skip(skip)
    .limit(limit)
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
/* ================= GET ALL COMPANY REQUESTS (ADMIN OR MANAGER) ================= */
exports.getAllLeaveRequests = asyncHandler(async (req, res) => {
  const {
    companyId,
    managerId,
    status,
    leaveType,
    startDate,
    endDate,
    search,
  } = req.query;

  if (!companyId) {
    return res
      .status(400)
      .json({ status: false, message: "companyId is required" });
  }

  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * pageSize;

  const filter = { companyId };
  if (managerId) filter.managerId = managerId;
  if (status) filter.status = status;
  if (leaveType) filter.leaveType = leaveType;
  if (startDate) filter.startDate = { $gte: new Date(startDate) };
  if (endDate) filter.endDate = { $lte: new Date(endDate) };

  let query = LeaveRequest.find(filter)
    .populate("leaveType")
    .populate("userId", "fullName email")
    .skip(skip)
    .limit(pageSize)
    .sort({ createdAt: -1 });

  if (search) {
    const regex = new RegExp(search, "i");
    query = query.populate({
      path: "userId",
      match: { fullName: regex },
      select: "fullName email",
    });
  }

  const totalItems = await LeaveRequest.countDocuments(filter);
  const totalPages = Math.ceil(totalItems / pageSize);

  const requests = await query;

  const filteredRequests = search ? requests.filter((r) => r.userId) : requests;

  res.status(200).json({
    status: true,
    page,
    totalPages,
    results: filteredRequests.length,
    totalItems,
    data: filteredRequests,
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

exports.getMyApprovals = asyncHandler(async (req, res) => {
  const requests = await leaveRequestModel
    .find({
      "approval.currentApprover": req.user._id,
      status: "pending",
    })
    .populate("userId", "fullName email")
    .populate("leaveType")
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: true,
    results: requests.length,
    data: requests,
  });
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

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const request = await LeaveRequest.findById(req.params.id)
      .populate("approval.flowId")
      .session(session);

    if (!request) {
      await session.abortTransaction();
      session.endSession();
      return next(new ApiError("Leave request not found", 404));
    }

    if (request.status !== "pending") {
      await session.abortTransaction();
      session.endSession();
      return next(new ApiError("Already processed", 400));
    }

    console.log("Calling handleApproval for leave request:", request._id);

    const updatedRequest = await handleApproval(
      request,
      req.user._id,
      action,
      reason,
      session,
    );

    console.log("handleApproval returned, status:", updatedRequest.status);

    if (updatedRequest.status === "approved" && !updatedRequest.approvedAt) {
      updatedRequest.approvedAt = new Date();

      await leavesLogsModel.create(
        [
          {
            userId: updatedRequest.userId,
            leaveRequestId: updatedRequest._id,
            leaveType: updatedRequest.leaveType,
            startDate: updatedRequest.startDate,
            endDate: updatedRequest.endDate,
            days: updatedRequest.days,
            approvedBy: req.user._id,
            approvedAt: updatedRequest.approvedAt,
            managerComment: reason || "",
            companyId: updatedRequest.companyId,
          },
        ],
        { session },
      );

      await updatedRequest.save({ session });
      console.log(
        "Leave log created for approved request:",
        updatedRequest._id,
      );
    }

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      status: true,
      message: `Leave request ${action} successfully`,
      data: updatedRequest,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    console.error("Transaction error in handleLeaveRequest:", err);
    return next(new ApiError(err.message, 400));
  }
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
