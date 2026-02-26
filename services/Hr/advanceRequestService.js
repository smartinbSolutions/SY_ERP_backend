const AdvanceRequest = require("../../models/Hr/advanceRequestModel");
const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const multer = require("multer");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const advanceLogsModel = require("../../models/Hr/advanceLogsModel");

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
  const {
    advanceTypeId,
    amount,
    reason,
    managerId,
    salarySnapshot,
    installmentAmount,
    totalInstallments,
  } = req.body;

  if (!req.user) return next(new ApiError("Not logged in", 401));

  if (!amount || amount <= 0)
    return next(new ApiError("Valid amount is required", 400));

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
  });

  res.status(201).json({
    status: true,
    message: "Advance request submitted",
    data: request,
  });
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

// ================= APPROVE / REJECT =================

exports.handleAdvanceRequest = asyncHandler(async (req, res, next) => {
  const { action, reason } = req.body;

  const request = await AdvanceRequest.findById(req.params.id);

  if (!request) return next(new ApiError("Request not found", 404));

  if (request.status !== "pending")
    return next(new ApiError("Already processed", 400));

  if (req.user._id.toString() !== request.managerId.toString()) {
    return next(new ApiError("Not authorized", 403));
  }

  if (action === "approve") {
    await advanceLogsModel.create({
      userId: request.userId,
      advanceRequestId: request._id,
      advanceTypeId: request.advanceTypeId,
      amount: request.amount,
      installmentAmount: request.installmentAmount,
      totalInstallments: request.installments,
      approvedBy: req.user._id,
      approvedAt: new Date(),
      managerComment: reason || "",
      companyId: request.companyId,
    });

    request.status = "approved";
  } else if (action === "reject") {
    request.status = "rejected";
    request.rejectionReason = reason || "";
  } else {
    return next(new ApiError("Invalid action", 400));
  }

  await request.save();

  res.status(200).json({
    status: true,
    message: `Request ${action} successfully`,
    data: request,
  });
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
