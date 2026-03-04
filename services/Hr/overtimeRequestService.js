const OvertimeRequest = require("../../models/Hr/overtimeRequestModel");
const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const multer = require("multer");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const overtimeLogsModel = require("../../models/Hr/overtimeLogsModel");

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

  const request = await OvertimeRequest.create({
    userId: req.user._id,
    companyId: req.user.companyId,
    overtimeTypeId,
    workDate,
    startTime,
    endTime,
    reason,
    managerId,
    hours,
    attachment: req.body.attachment || null,
  });

  res.status(201).json({
    status: true,
    message: "Overtime request submitted",
    data: request,
  });
});

// ================= MY REQUESTS =================

exports.getMyOvertimeRequests = asyncHandler(async (req, res) => {
  const requests = await OvertimeRequest.find({
    userId: req.user._id,
  })
    .populate("overtimeTypeId")
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: true,
    results: requests.length,
    data: requests,
  });
});

// ================= ALL COMPANY REQUESTS =================

exports.getAllOvertimeRequests = asyncHandler(async (req, res) => {
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

  const totalItems = await OvertimeRequest.countDocuments(filter);

  const requests = await OvertimeRequest.find(filter)
    .populate("userId", "fullName email")
    .populate("overtimeTypeId")
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

  const request = await OvertimeRequest.findById(req.params.id);

  if (!request) return next(new ApiError("Request not found", 404));

  if (request.status !== "pending")
    return next(new ApiError("Already processed", 400));

  if (req.user._id.toString() !== request.managerId.toString()) {
    return next(new ApiError("Not authorized", 403));
  }

  if (action === "approve") {
    await overtimeLogsModel.create({
      userId: request.userId,
      overtimeRequestId: request._id,
      overtimeType: request.overtimeTypeId._id,
      hours: request.hours,
      rateMultiplier: request.overtimeTypeId?.rateMultiplier || 1,
      calculatedPay: 0,
      leaveEarned: 0,
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

exports.deleteOvertimeRequest = asyncHandler(async (req, res, next) => {
  const request = await OvertimeRequest.findById(req.params.id);

  if (!request) return next(new ApiError("Request not found", 404));

  await OvertimeRequest.deleteOne({ _id: request._id });

  res.status(200).json({
    status: true,
    message: "Request deleted",
  });
});
