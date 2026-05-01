const OvertimeRequest = require("../../../models/Hr/Overtime/overtimeRequestModel");
const asyncHandler = require("express-async-handler");
const ApiError = require("../../../utils/apiError");
const multer = require("multer");
const mongoose = require("mongoose");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const overtimeLogsModel = require("../../../models/Hr/Overtime/overtimeLogsModel");
const approvalFlowModel = require("../../../models/Hr/approvalFlowModel");
const { handleApproval } = require("../approvalService");
const overtimeTypesModel = require("../../../models/Hr/Overtime/overtimeTypesModel");
const overtimeRequestModel = require("../../../models/Hr/Overtime/overtimeRequestModel");
const NotificationModel = require("../../../models/Hr/NotificationModel");
const staffModel = require("../../../models/Hr/staffModel");

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
    const { overtimeTypeId, workDate, startTime, endTime, hours, reason } =
      req.body;

    // 1️⃣ التحقق من تسجيل الدخول
    if (!req.user) return next(new ApiError("Not logged in", 401));

    // 2️⃣ جلب بيانات الموظف
    const requester = await staffModel.findById(req.user._id);
    if (!requester) return next(new ApiError("User not found", 404));

    // 3️⃣ جلب نوع الـ overtime والـ flow
    const type = await overtimeTypesModel
      .findById(overtimeTypeId)
      .populate("policyId");
    if (!type) return next(new ApiError("Overtime type not found", 404));

    const flowId = type.approvalFlow || type.policyId?.approvalFlow;
    if (!flowId) return next(new ApiError("Approval flow not found", 404));

    const flow = await approvalFlowModel.findById(flowId);
    if (!flow) return next(new ApiError("Approval flow not found", 404));

    // 4️⃣ بناء خطوات الموافقة مع تجاوز self-approval والمدير المباشر
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

      // حالة skip إذا ما في approver
      const status = approverId ? "pending" : "skipped";

      approvalSteps.push({
        stepNumber: step.stepNumber,
        stepName: step.stepName || "",
        approverId,
        status,
        actedBy: null,
        actedAt: null,
        comment: "",
      });
    }

    // 5️⃣ تحديد أول approver فعلي
    const firstPending = approvalSteps.find((s) => s.status === "pending");
    const currentApprover = firstPending?.approverId || null;
    const currentStep = firstPending?.stepNumber || null;

    // 6️⃣ إنشاء طلب الـ overtime
    const request = await OvertimeRequest.create({
      userId: requester._id,
      companyId: requester.companyId,
      overtimeTypeId,
      workDate,
      startTime,
      endTime,
      hours,
      reason,
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

    // 7️⃣ الرد
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
  const filter = { userId: req.user._id };

  if (req.query.status) filter.status = req.query.status;

  const allRequests = await OvertimeRequest.find({
    userId: req.user._id,
  }).select("hours status");

  const getHours = (request) => Number(request.hours) || 0;
  const summary = {
    total: allRequests.reduce((sum, request) => sum + getHours(request), 0),
    approved: allRequests
      .filter((request) => request.status === "approved")
      .reduce((sum, request) => sum + getHours(request), 0),
    pending: allRequests
      .filter((request) => request.status === "pending")
      .reduce((sum, request) => sum + getHours(request), 0),
    rejected: allRequests
      .filter((request) => request.status === "rejected")
      .reduce((sum, request) => sum + getHours(request), 0),
  };

  const totalRequests = await OvertimeRequest.countDocuments(filter);

  const requests = await OvertimeRequest.find(filter)
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
    totalItems: totalRequests,
    summary,
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
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const { status } = req.query;

  const filter =
    status && status !== "pending"
      ? { "approval.steps.actedBy": req.user._id, status }
      : status === "pending"
        ? { "approval.currentApprover": req.user._id, status: "pending" }
        : {
            $or: [
              { "approval.currentApprover": req.user._id, status: "pending" },
              { "approval.steps.actedBy": req.user._id },
            ],
          };

  const totalItems = await overtimeRequestModel.countDocuments(filter);
  const requests = await overtimeRequestModel
    .find(filter)
    .populate("userId", "fullName email")
    .populate("overtimeTypeId")
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: true,
    page,
    limit,
    totalItems,
    totalPages: Math.ceil(totalItems / limit),
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

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log("====================================");
    console.log("🚀 HANDLE OVERTIME REQUEST START");
    console.log("Request ID:", req.params.id);
    console.log("Action:", action);
    console.log("Approver:", req.user._id);
    console.log("====================================");

    // =========================
    // STEP 1: FETCH REQUEST
    // =========================
    console.log("🔍 STEP 1: Fetching request...");

    let request = await OvertimeRequest.findById(req.params.id)
      .populate("approval.flowId")
      .populate("overtimeTypeId")
      .session(session);

    if (!request) {
      console.log("❌ Request not found");
      throw new ApiError("Request not found", 404);
    }

    console.log("📄 Request found: true");
    console.log("📊 Current Status:", request.status);
    console.log("👤 Current Approver:", request.approval?.currentApprover);
    console.log("📌 Current Step:", request.approval?.currentStep);

    if (request.status !== "pending") {
      throw new ApiError("Already processed", 400);
    }

    // =========================
    // STEP 2: HANDLE APPROVAL FLOW
    // =========================
    console.log("⚙️ STEP 2: Running handleApproval...");

    await handleApproval(request, req.user._id, action, reason, session);

    console.log("✅ handleApproval DONE");

    // =========================
    // STEP 3: GET FRESH REQUEST (IMPORTANT FIX)
    // =========================
    console.log("🔄 STEP 3: Re-fetching updated request...");

    request = await OvertimeRequest.findById(req.params.id)
      .populate("overtimeTypeId")
      .session(session);

    console.log("📊 Updated Status:", request.status);

    // =========================
    // STEP 4: LOG CREATION (ONLY IF APPROVED)
    // =========================
    if (request.status === "approved") {
      console.log("🟢 FINAL APPROVAL → creating log");

      const approvedAt = new Date();
      request.approvedAt = approvedAt;

      const type = request.overtimeTypeId;

      // RULE SNAPSHOT
      const ruleSnapshot = {
        typeKey: type.typeKey,
        rateMultiplier: type.rateMultiplier,
        leaveMultiplier: type.leaveMultiplier,
        weeklyLimit: type.weeklyLimit,
        dailyLimit: type.dailyLimit,
        applicableDayType: type.applicableDayType,
      };

      // CALCULATION
      const hours = Number(request.hours || 0);

      const appliedRateMultiplier = type.rateMultiplier || 1;
      const appliedLeaveMultiplier = type.leaveMultiplier || 0;

      const calculatedPay = hours * appliedRateMultiplier;
      const leaveEarned = hours * appliedLeaveMultiplier;

      const calculation = {
        hours,
        appliedRateMultiplier,
        appliedLeaveMultiplier,
        calculatedPay,
        leaveEarned,
      };

      console.log("📦 Rule Snapshot:", ruleSnapshot);
      console.log("📊 Calculation:", calculation);

      // CREATE LOG
      await overtimeLogsModel.create(
        [
          {
            userId: request.userId,
            overtimeRequestId: request._id,
            overtimeType: type._id,
            ruleSnapshot,
            calculation,
            approvedBy: req.user._id,
            approvedAt,
            managerComment: reason || "",
            companyId: request.companyId,
          },
        ],
        { session },
      );

      console.log("✅ LOG CREATED");

      await request.save({ session });
      console.log("💾 REQUEST SAVED");
    } else {
      console.log("⏭️ Not final approval → skipping log creation");
    }

    // =========================
    // STEP 5: NOTIFICATION (FIXED)
    // =========================
    console.log("🔔 STEP 5: Sending notification...");

    const status = request.status || "unknown";

    await NotificationModel.create(
      [
        {
          recipient: request.userId,
          actor: req.user._id,
          title: `Overtime ${status.charAt(0).toUpperCase() + status.slice(1)}`,
          message: `Your overtime request status changed to ${status}`,
          entity: {
            id: request._id,
            model: "OvertimeRequest",
          },
        },
      ],
      { session },
    );

    console.log("📨 Notification sent");

    // =========================
    // COMMIT
    // =========================
    await session.commitTransaction();
    session.endSession();

    console.log("🎉 TRANSACTION SUCCESS");

    return res.status(200).json({
      status: true,
      message: `Request ${action} successfully`,
      data: request,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    console.error("🔥 TRANSACTION ERROR:", err);
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
