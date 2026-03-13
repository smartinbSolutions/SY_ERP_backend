const OvertimeRequest = require("../../models/Hr/overtimeRequestModel");
const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const multer = require("multer");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const overtimeLogsModel = require("../../models/Hr/overtimeLogsModel");
const approvalFlowModel = require("../../models/Hr/approvalFlowModel");
const { handleApproval } = require("./approvalService");
const overtimeTypesModel = require("../../models/Hr/overtimeTypesModel");
const overtimeRequestModel = require("../../models/Hr/overtimeRequestModel");

// ================= MULTER =================

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

const upload = multer({
  storage: multerStorage,
  fileFilter: attachmentFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

exports.uploadOvertimeAttachment = upload.single("attachment");

// ================= SAVE FILE =================

exports.processOvertimeAttachment = asyncHandler(async (req, res, next) => {
  if (!req.file) return next();

  await fs.promises.mkdir("uploads/overtimeAttachments", { recursive: true });

  const ext = path.extname(req.file.originalname);
  const filename = `overtime-${uuidv4()}-${Date.now()}${ext}`;

  await fs.promises.writeFile(
    `uploads/overtimeAttachments/${filename}`,
    req.file.buffer,
  );

  req.body.attachment = filename;

  next();
});

// ================= CREATE =================

exports.createOvertimeRequest = asyncHandler(async (req, res, next) => {
  try {
    const {
      overtimeTypeId,
      workDate,
      startTime,
      endTime,
      hours,
      reason,
      managerId,
    } = req.body;

    if (!req.user) return next(new ApiError("Not logged in", 401));

    const type = await overtimeTypesModel
      .findById(overtimeTypeId)
      .populate("policyId");
    if (!type) return next(new ApiError("Overtime type not found", 404));

    const flowId = type.approvalFlow || type.policyId?.approvalFlow;
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

    const request = await OvertimeRequest.create({
      userId: req.user._id,
      companyId: req.user.companyId,
      overtimeTypeId,
      workDate,
      startTime,
      endTime,
      hours,
      reason,
      managerId,
      attachment: req.body.attachment || null,
      approval: {
        flowId: flow._id,
        currentStep: 1,
        currentApprover: approvalSteps[0]?.approverId || null,
        steps: approvalSteps,
      },
    });

    res.status(201).json({
      status: true,
      message: "Overtime request submitted",
      data: request,
    });
  } catch (err) {
    console.error("Error in createOvertimeRequest:", err);
    return next(err);
  }
});

// ================= MY REQUESTS =================

exports.getMyOvertimeRequests = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const totalRequests = await OvertimeRequest.countDocuments({
    userId: req.user._id,
  });

  const requests = await OvertimeRequest.find({ userId: req.user._id })
    .populate("overtimeTypeId")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const totalPages = Math.ceil(totalRequests / limit);

  res.status(200).json({
    status: true,
    results: requests.length,
    totalPages,
    page,
    limit,
    data: requests,
  });
});

// ================= ALL COMPANY REQUESTS =================

exports.getAllOvertimeRequests = asyncHandler(async (req, res) => {
  const {
    companyId,
    managerId,
    status,
    search,
    page: pageQuery,
    limit: limitQuery,
  } = req.query;

  if (!companyId) {
    return res
      .status(400)
      .json({ status: false, message: "companyId is required" });
  }

  const page = parseInt(pageQuery) || 1;
  const limit = parseInt(limitQuery) || 20;
  const skip = (page - 1) * limit;

  const filter = { companyId };
  if (managerId) filter.managerId = managerId;
  if (status) filter.status = status;

  let query = OvertimeRequest.find(filter)
    .populate("overtimeTypeId")
    .populate("userId", "fullName email")
    .sort({ createdAt: -1 });

  if (search) {
    const regex = new RegExp(search, "i");
    query = query.populate({
      path: "userId",
      match: { fullName: regex },
      select: "fullName email",
    });
  }

  let results = await query;

  if (search) {
    results = results.filter((r) => r.userId);
  }

  const totalItems = results.length;
  const totalPages = Math.ceil(totalItems / limit);
  const paginatedResults = results.slice(skip, skip + limit);

  res.status(200).json({
    status: true,
    page,
    results: paginatedResults.length,
    totalItems,
    totalPages,
    data: paginatedResults,
  });
});

// ================= GET ONE =================

exports.getOvertimeRequestById = asyncHandler(async (req, res, next) => {
  const request = await OvertimeRequest.findById(req.params.id)
    .populate("userId", "fullName email")
    .populate("overtimeTypeId");

  if (!request) return next(new ApiError("Overtime request not found", 404));

  res.status(200).json({
    status: true,
    data: request,
  });
});

exports.getMyApprovals = asyncHandler(async (req, res) => {
  const requests = await overtimeRequestModel
    .find({
      "approval.currentApprover": req.user._id,
      status: "pending",
    })
    .populate("userId", "fullName email")
    .populate("overtimeTypeId")
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: true,
    results: requests.length,
    data: requests,
  });
});

// ================= UPDATE =================

exports.updateOvertimeRequest = asyncHandler(async (req, res, next) => {
  const request = await OvertimeRequest.findById(req.params.id);

  if (!request) return next(new ApiError("Request not found", 404));

  if (request.status !== "pending")
    return next(new ApiError("Cannot edit processed request", 400));

  const { overtimeTypeId, workDate, startTime, endTime, reason } = req.body;

  request.overtimeTypeId = overtimeTypeId || request.overtimeTypeId;
  request.workDate = workDate || request.workDate;
  request.startTime = startTime || request.startTime;
  request.endTime = endTime || request.endTime;
  request.reason = reason || request.reason;
  if (req.body.attachment) {
    request.attachment = req.body.attachment;
  }

  await request.save();

  res.status(200).json({
    status: true,
    data: request,
  });
});

// ================= APPROVE / REJECT =================

exports.handleOvertimeRequest = asyncHandler(async (req, res, next) => {
  const { action, reason } = req.body;

  const request = await OvertimeRequest.findById(req.params.id).populate(
    "approval.flowId",
  );

  if (!request) return next(new ApiError("Request not found", 404));

  if (request.status !== "pending")
    return next(new ApiError("Already processed", 400));

  try {
    console.log("User attempting approval:", req.user?._id);
    console.log("Action:", action, "Reason:", reason);

    const updatedRequest = await handleApproval(
      request,
      req.user._id,
      action,
      reason,
    );

    if (updatedRequest.status === "approved" && !updatedRequest.approvedAt) {
      updatedRequest.approvedAt = new Date();

      await overtimeLogsModel.create({
        userId: updatedRequest.userId,
        overtimeRequestId: updatedRequest._id,
        overtimeType: updatedRequest.overtimeTypeId._id,
        hours: updatedRequest.hours,
        rateMultiplier: updatedRequest.overtimeTypeId?.rateMultiplier || 1,
        calculatedPay: 0,
        leaveEarned: 0,
        approvedBy: req.user._id,
        approvedAt: updatedRequest.approvedAt,
        managerComment: reason || "",
        companyId: updatedRequest.companyId,
      });

      await updatedRequest.save();
      console.log(
        "Overtime log created for approved request:",
        updatedRequest._id,
      );
    }

    res.status(200).json({
      status: true,
      message: `Request ${action} successfully`,
      data: updatedRequest,
    });
  } catch (err) {
    console.error("Error in handleOvertimeRequest:", err);
    return next(new ApiError(err.message, 400));
  }
});

// ================= DELETE =================

exports.deleteOvertimeRequest = asyncHandler(async (req, res, next) => {
  const request = await OvertimeRequest.findById(req.params.id);

  if (!request) return next(new ApiError("Request not found", 404));

  await OvertimeRequest.deleteOne({ _id: request._id });

  res.status(200).json({
    status: true,
    message: "Request deleted",
  });
});
