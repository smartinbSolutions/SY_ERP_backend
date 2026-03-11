const AdvanceRequest = require("../../models/Hr/advanceRequestModel");
const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const multer = require("multer");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const advanceLogsModel = require("../../models/Hr/advanceLogsModel");
const { handleApproval } = require("./approvalService");
const approvalFlowModel = require("../../models/Hr/approvalFlowModel");
const advanceTypesModel = require("../../models/Hr/advanceTypesModel");

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

exports.uploadAdvanceAttachment = upload.single("attachment");

// ================= SAVE FILE =================

exports.processAdvanceAttachment = asyncHandler(async (req, res, next) => {
  if (!req.file) return next();

  await fs.promises.mkdir("uploads/advanceAttachments", { recursive: true });

  const ext = path.extname(req.file.originalname);
  const filename = `advance-${uuidv4()}-${Date.now()}${ext}`;

  await fs.promises.writeFile(
    `uploads/advanceAttachments/${filename}`,
    req.file.buffer,
  );

  req.body.attachment = filename;

  next();
});

// ================= CREATE =================

exports.createAdvanceRequest = asyncHandler(async (req, res, next) => {
  try {
    const {
      advanceTypeId,
      amount,
      reason,
      managerId,
      salarySnapshot,
      installmentAmount,
      totalInstallments,
    } = req.body;

    console.log("User:", req.user?._id);
    if (!req.user) return next(new ApiError("Not logged in", 401));
    if (!amount || amount <= 0)
      return next(new ApiError("Valid amount is required", 400));

    console.log("Fetching advance type:", advanceTypeId);
    const type = await advanceTypesModel
      .findById(advanceTypeId)
      .populate("policyId");
    console.log("Type found:", !!type);

    if (!type) return next(new ApiError("Advance type not found", 404));
    if (!type.approvalFlow && (!type.policyId || !type.policyId.approvalFlow))
      return next(new ApiError("Approval flow not found", 404));

    const flowId = type.approvalFlow || type.policyId.approvalFlow;
    console.log("Using approval flow ID:", flowId);
    const flow = await approvalFlowModel.findById(flowId);
    console.log("Flow found:", !!flow);

    if (!flow) return next(new ApiError("Approval flow not found", 404));

    const approvalSteps = flow.steps.map((step) => ({
      stepNumber: step.stepNumber,
      stepName: step.stepName || "",
      approverId: step.approver.employeeId,
      status: "pending",
      actedBy: null,
      actedAt: null,
      comment: "",
    }));
    console.log("Approval steps:", approvalSteps);

    const request = await AdvanceRequest.create({
      userId: req.user._id,
      companyId: req.user.companyId,
      advanceTypeId,
      amount,
      reason,
      managerId,
      salarySnapshot,
      installmentAmount: installmentAmount || null,
      totalInstallments: totalInstallments || null,
      attachment: req.body.attachment || null,
      approval: {
        flowId: flow._id,
        currentStep: 1,
        currentApprover: approvalSteps[0]?.approverId || null,
        steps: approvalSteps,
        history: [],
      },
    });

    console.log("Advance request created:", request._id);

    res.status(201).json({
      status: true,
      message: "Advance request submitted",
      data: request,
    });
  } catch (err) {
    console.error("Error in createAdvanceRequest:", err);
    return next(err);
  }
});

// ================= MY REQUESTS =================

exports.getMyAdvanceRequests = asyncHandler(async (req, res) => {
  const requests = await AdvanceRequest.find({
    userId: req.user._id,
  })
    .populate("advanceTypeId")
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: true,
    results: requests.length,
    data: requests,
  });
});

// ================= ALL COMPANY REQUESTS =================

exports.getAllAdvanceRequests = asyncHandler(async (req, res) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res
      .status(400)
      .json({ status: false, message: "companyId is required" });
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const filter = { companyId };

  const totalItems = await AdvanceRequest.countDocuments(filter);

  const requests = await AdvanceRequest.find(filter)
    .populate("userId", "fullName email")
    .populate("advanceTypeId")
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: true,
    page,
    results: requests.length,
    totalItems,
    totalPages: Math.ceil(totalItems / limit),
    data: requests,
  });
});

// ================= GET ONE =================

exports.getAdvanceRequestById = asyncHandler(async (req, res, next) => {
  const request = await AdvanceRequest.findById(req.params.id)
    .populate("userId", "fullName email")
    .populate("advanceTypeId");

  if (!request) return next(new ApiError("Advance request not found", 404));

  res.status(200).json({
    status: true,
    data: request,
  });
});

// ================= UPDATE =================

exports.updateAdvanceRequest = asyncHandler(async (req, res, next) => {
  const request = await AdvanceRequest.findById(req.params.id);

  if (!request) return next(new ApiError("Request not found", 404));

  if (request.status !== "pending")
    return next(new ApiError("Cannot edit processed request", 400));

  const { advanceTypeId, amount, reason } = req.body;

  request.advanceTypeId = advanceTypeId || request.advanceTypeId;
  request.amount = amount || request.amount;
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

exports.getMyApprovals = asyncHandler(async (req, res) => {
  const requests = await AdvanceRequest.find({
    "approval.currentApprover": req.user._id,
    status: "pending",
  })
    .populate("userId", "fullName email")
    .populate("advanceTypeId")
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: true,
    results: requests.length,
    data: requests,
  });
});

exports.handleAdvanceRequest = asyncHandler(async (req, res, next) => {
  const { action, reason } = req.body;

  console.log("User attempting approval:", req.user?._id);
  console.log("Action:", action, "Reason:", reason);

  const request = await AdvanceRequest.findById(req.params.id).populate(
    "approval.flowId"
  );

  if (!request) return next(new ApiError("Request not found", 404));
  if (request.status !== "pending")
    return next(new ApiError("Already processed", 400));

  try {
    console.log("Calling handleApproval for request:", request._id);

    const updatedRequest = await handleApproval(
      request,
      req.user._id,
      action === "approve" ? "approved" : "rejected",
      reason
    );

    console.log("handleApproval returned, status:", updatedRequest.status);

    // If fully approved, create the log
    if (updatedRequest.status === "approved" && !updatedRequest.approvedAt) {
      updatedRequest.approvedAt = new Date();

      await advanceLogsModel.create({
        userId: updatedRequest.userId,
        advanceRequestId: updatedRequest._id,
        advanceTypeId: updatedRequest.advanceTypeId,
        amount: updatedRequest.amount,
        installmentAmount: updatedRequest.installmentAmount,
        totalInstallments: updatedRequest.installments,
        approvedBy: req.user._id,
        approvedAt: updatedRequest.approvedAt,
        managerComment: reason || "",
        companyId: updatedRequest.companyId,
      });

      await updatedRequest.save();
      console.log("Advance log created for approved request:", updatedRequest._id);
    }

    res.status(200).json({
      status: true,
      message: `Request ${action} successfully`,
      data: updatedRequest,
    });
  } catch (err) {
    console.error("Error in handleAdvanceRequest:", err);
    return next(new ApiError(err.message, 400));
  }
});

// ================= DELETE =================

exports.deleteAdvanceRequest = asyncHandler(async (req, res, next) => {
  const request = await AdvanceRequest.findById(req.params.id);

  if (!request) return next(new ApiError("Request not found", 404));

  await AdvanceRequest.deleteOne({ _id: request._id });

  res.status(200).json({
    status: true,
    message: "Request deleted",
  });
});
