const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const multer = require("multer");
const service = require("../../services/Hr/advanceRequestService");
const { default: mongoose } = require("mongoose");
const staffModel = require("../../models/Hr/staffModel");

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
    const {
      advanceTypeId,
      amount,
      reason,
      // salarySnapshot,
      installmentAmount,
      totalInstallments,
    } = req.body;

    if (!req.user) return next(new ApiError("Not logged in", 401));
    if (!amount || amount <= 0)
      return next(new ApiError("Valid amount is required", 400));

    // 1️⃣ جلب بيانات الموظف
    const requester = await staffModel.findById(req.user._aid);
    if (!requester) return next(new ApiError("User not found", 404));

    // 2️⃣ جلب نوع السلفة والـ flow
    const type = await service.getAdvanceTypeById(advanceTypeId);
    if (!type) return next(new ApiError("Advance type not found", 404));

    const flowId = type.approvalFlow || type.policyId?.approvalFlow;
    if (!flowId) return next(new ApiError("Approval flow not found", 404));

    const flow = await service.getApprovalFlowById(flowId);
    if (!flow) return next(new ApiError("Approval flow not found", 404));

    // بناء خطوات الموافقة مع تجاوز self-approval والمدير المباشر
    let approvalSteps = [];

    for (const step of flow.steps) {
      let approverId = null;

      // المدير المباشر
      if (step.isDirectManager) {
        approverId = requester.directManager;
      } else if (step.approver?.employeeId) {
        approverId = step.approver.employeeId;
      }

      // تجاوز self-approval
      if (approverId && approverId.toString() === requester._id.toString()) {
        approverId = null;
      }

      const status = approverId ? "pending" : "skipped";

      approvalSteps.push({
        stepNumber: step.stepNumber,
        approverId,
        status,
        actedBy: null,
        actedAt: null,
        comment: "",
      });
    }

    // تحديد أول approver فعلي
    const firstPending = approvalSteps.find((s) => s.status === "pending");
    const currentApprover = firstPending?.approverId || null;
    const currentStep = firstPending?.stepNumber || null;

    //  إنشاء طلب السلفة عن طريق الخدمة
    const request = await service.createAdvanceRequest({
      userId: requester._id,
      companyId: requester.companyId,
      advanceTypeId,
      amount,
      reason,
      // salarySnapshot,
      installmentAmount: installmentAmount || null,
      totalInstallments: totalInstallments || null,
      attachment: req.body.attachment || null,
      approval: {
        flowId: flow._id,
        currentStep,
        currentApprover,
        steps: approvalSteps,
      },
      status: currentApprover ? "pending" : "approved",
      approvedAt: currentApprover ? null : new Date(),
    });

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
    // GET REQUEST
    // =========================
    const request = await service.getById(req.params.id);

    if (!request) {
      throw new ApiError("Request not found", 404);
    }

    if (request.status !== "pending") {
      throw new ApiError("Already processed", 400);
    }

    // =========================
    // HANDLE APPROVAL (CORE LOGIC)
    // =========================
    const updatedRequest = await service.handleApprovalTransaction(
      request,
      req.user._id,
      action,
      reason,
      session,
    );

    // =========================
    // COMMIT
    // =========================
    await session.commitTransaction();

    res.status(200).json({
      status: true,
      message: `Request ${action} successfully`,
      data: updatedRequest,
    });
  } catch (err) {
    // =========================
    // ROLLBACK
    // =========================
    await session.abortTransaction();

    console.error("Transaction error in handleAdvanceRequest:", err);

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
