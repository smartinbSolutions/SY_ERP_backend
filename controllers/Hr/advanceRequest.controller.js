const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const multer = require("multer");
const service = require("../../services/Hr/Advance/advanceRequestService");
const { default: mongoose } = require("mongoose");
const staffModel = require("../../models/Hr/staffModel");
const advanceRequestModel = require("../../models/Hr/Advance/advanceRequestModel");

// ================= MULTER =================
const multerStorage = multer.memoryStorage();
const attachmentFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  if (allowedTypes.includes(file.mimetype)) cb(null, true);
  else cb(new ApiError("File type not allowed", 400), false);
};
const upload = multer({
  storage: multerStorage,
  fileFilter: attachmentFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});
exports.uploadAdvanceAttachment = upload.single("attachment");

// ================= PROCESS FILE =================
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
    console.log("➡️ CREATE ADVANCE REQUEST START");

    const {
      advanceTypeId,
      amount,
      reason,
      installments,
      installmentAmount,
      attachment,
    } = req.body;

    console.log("📥 BODY:", req.body);

    if (!req.user) {
      console.log("❌ No user in request");
      return next(new ApiError("Not logged in", 401));
    }

    if (!amount || amount <= 0) {
      console.log("❌ Invalid amount:", amount);
      return next(new ApiError("Valid amount is required", 400));
    }

    // =========================
    // GET REQUESTER
    // =========================
    const requester = await staffModel.findById(req.user._id);

    if (!requester) {
      console.log("❌ Requester not found:", req.user._id);
      return next(new ApiError("User not found", 404));
    }

    console.log("👤 REQUESTER FOUND:", requester._id);

    // =========================
    // GET ADVANCE TYPE
    // =========================
    const type = await service.getAdvanceTypeById(advanceTypeId);

    if (!type) {
      console.log("❌ Advance type not found:", advanceTypeId);
      return next(new ApiError("Advance type not found", 404));
    }

    console.log("📌 ADVANCE TYPE:", type._id);

    // =========================
    // GET FLOW
    // =========================
    const flowId = type.approvalFlow || type.policyId?.approvalFlow;

    console.log("🔄 FLOW ID:", flowId);

    if (!flowId) {
      console.log("❌ No flow linked to type");
      return next(new ApiError("Approval flow not found", 404));
    }

    const flow = await service.getApprovalFlowById(flowId);

    if (!flow) {
      console.log("❌ Flow not found:", flowId);
      return next(new ApiError("Approval flow not found", 404));
    }

    console.log("📊 FLOW STEPS COUNT:", flow.steps.length);

    // =========================
    // BUILD APPROVAL STEPS
    // =========================
    const approvalSteps = [];

    for (const step of flow.steps) {
      let approverId = null;

      if (step.isDirectManager) {
        approverId = requester.directManager;
      } else if (step.approver?.employeeId) {
        approverId = step.approver.employeeId;
      }

      if (approverId && approverId.toString() === requester._id.toString()) {
        console.log("⚠️ SELF APPROVAL SKIPPED");
        approverId = null;
      }

      approvalSteps.push({
        stepNumber: step.stepNumber,
        approverId,
        status: approverId ? "pending" : "skipped",
        actedBy: null,
        actedAt: null,
        comment: "",
      });
    }

    const firstPending = approvalSteps.find((s) => s.status === "pending");

    const currentApprover = firstPending?.approverId || null;
    const currentStep = firstPending?.stepNumber || null;

    console.log("👉 FIRST APPROVER:", currentApprover);
    console.log("👉 CURRENT STEP:", currentStep);

    // =========================
    // CREATE REQUEST
    // =========================
    const requestData = {
      userId: requester._id,
      companyId: requester.companyId,
      advanceTypeId,
      amount,
      reason,
      installments: installments || null,
      installmentAmount: installmentAmount || null,
      attachment: attachment || null,

      approval: {
        flowId: flow._id,
        currentStep,
        currentApprover,
        steps: approvalSteps,
      },

      status: currentApprover ? "pending" : "approved",
      approvedAt: currentApprover ? null : new Date(),
    };

    console.log("🧾 FINAL REQUEST DATA:", requestData);

    const request = await service.createAdvanceRequest(requestData);

    console.log("✅ ADVANCE REQUEST CREATED:", request._id);

    return res.status(201).json({
      status: true,
      message: "Advance request submitted successfully",
      data: request,
    });
  } catch (err) {
    console.error("🔥 CREATE ADVANCE ERROR:", err);
    return next(err);
  }
});

// ================= GET MY REQUESTS =================
exports.getMyAdvanceRequests = asyncHandler(async (req, res) => {
  const requests = await service.getMyRequests(req.user._id);
  res
    .status(200)
    .json({ status: true, results: requests.length, data: requests });
});

// ================= GET ALL COMPANY REQUESTS =================
exports.getAllAdvanceRequests = asyncHandler(async (req, res) => {
  const companyId = req.query.companyId;
  if (!companyId)
    return res
      .status(400)
      .json({ status: false, message: "companyId is required" });

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const { requests, total } = await service.getCompanyRequests(
    companyId,
    skip,
    limit,
  );

  res.status(200).json({
    status: true,
    page,
    results: requests.length,
    totalItems: total,
    totalPages: Math.ceil(total / limit),
    data: requests,
  });
});

// ================= GET ONE =================
exports.getAdvanceRequestById = asyncHandler(async (req, res, next) => {
  const request = await service.getById(req.params.id);
  if (!request) return next(new ApiError("Advance request not found", 404));
  res.status(200).json({ status: true, data: request });
});

// ================= UPDATE =================
exports.updateAdvanceRequest = asyncHandler(async (req, res, next) => {
  const request = await service.getById(req.params.id);
  if (!request) return next(new ApiError("Request not found", 404));
  if (request.status !== "pending")
    return next(new ApiError("Cannot edit processed request", 400));

  const { advanceTypeId, amount, reason } = req.body;
  request.advanceTypeId = advanceTypeId || request.advanceTypeId;
  request.amount = amount || request.amount;
  request.reason = reason || request.reason;
  if (req.body.attachment) request.attachment = req.body.attachment;

  await service.saveRequest(request);
  res.status(200).json({ status: true, data: request });
});

// ================= GET MY APPROVALS =================
exports.getMyApprovals = asyncHandler(async (req, res) => {
  const requests = await service.getMyApprovals(req.user._id);
  res
    .status(200)
    .json({ status: true, results: requests.length, data: requests });
});

// ================= HANDLE =================
exports.handleAdvanceRequest = asyncHandler(async (req, res, next) => {
  const { action, reason } = req.body;

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // =========================
    // GET REQUEST (INSIDE SESSION)
    // =========================
    const request = await advanceRequestModel
      .findById(req.params.id)
      .session(session);

    if (!request) {
      throw new ApiError("Request not found", 404);
    }

    if (request.status !== "pending") {
      throw new ApiError("Already processed", 400);
    }

    // =========================
    // HANDLE SERVICE
    // =========================
    const updatedRequest = await service.handleApprovalTransaction(
      request,
      req.user._id,
      action,
      reason,
      session,
    );

    await session.commitTransaction();

    res.status(200).json({
      status: true,
      message: `Request ${action} successfully`,
      data: updatedRequest,
    });
  } catch (err) {
    await session.abortTransaction();
    return next(new ApiError(err.message, 400));
  } finally {
    session.endSession();
  }
});
// ================= DELETE =================
exports.deleteAdvanceRequest = asyncHandler(async (req, res, next) => {
  const request = await service.getById(req.params.id);
  if (!request) return next(new ApiError("Request not found", 404));

  await service.deleteById(request._id);
  res.status(200).json({ status: true, message: "Request deleted" });
});
