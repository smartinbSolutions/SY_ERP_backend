const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const ViolationLog = require("../../models/Hr/violationLogModel");
const mongoose = require("mongoose");
const staffModel = require("../../models/Hr/staffModel");

/* =====================================================
   GET ALL
===================================================== */
exports.getAllViolationLogs = asyncHandler(async (req, res, next) => {
  const { companyId, userId, violationType } = req.query;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  const query = { companyId };

  if (userId) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return next(new ApiError("Invalid userId format", 400));
    }
    query.userId = userId;
  }

  if (violationType) {
    query.violationType = violationType;
  }

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const total = await ViolationLog.countDocuments(query);

  const data = await ViolationLog.find(query)
    .skip(skip)
    .limit(limit)
    .sort({ violationDate: -1 });

  res.status(200).json({
    status: "success",
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results: data.length,
    data,
  });
});

/* =====================================================
   GET ONE
===================================================== */
exports.getOneViolationLog = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { id } = req.params;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ApiError("Invalid ID format", 400));
  }

  const doc = await ViolationLog.findOne({
    _id: id,
    companyId,
  });

  if (!doc) {
    return next(new ApiError("Violation log not found", 404));
  }

  res.status(200).json({
    status: "success",
    data: doc,
  });
});

exports.processDailyAbsenceViolations = async () => {
  const today = new Date().toISOString().slice(0, 10);

  const staffList = await staffModel
    .find({ employmentStatus: true })
    .populate("groupId");

  for (const staff of staffList) {
    const group = staff.groupId;

    if (!group) continue;

    // 1. check fingerprint
    const fp = await Fingerprint.findOne({
      userID: staff._id,
      date: today,
    });

    if (fp) continue;

    // 2. off day check
    if (group.offDays?.includes(getDayName(today))) continue;

    // 3. calendar holiday check
    const isHoliday = group.calendarRules?.some(
      (rule) =>
        rule.effectType === "holiday" &&
        today >= rule.startDate &&
        today <= rule.endDate,
    );

    if (isHoliday) continue;

    // 4. create absence violation
    await ViolationLog.create({
      userId: staff._id,
      companyId: staff.companyId,
      violationType: "absence",
      violationDate: today,
      isExcused: false,
    });
  }
};

/* =====================================================
   CREATE (MANUAL / SYSTEM ENTRY)
===================================================== */
exports.createViolationLog = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  const {
    userId,
    violationType,
    violationDate,
    minutesLate,
    isExcused,
    relatedAttendanceId,
  } = req.body;

  if (!userId || !violationType || !violationDate) {
    return next(
      new ApiError("userId, violationType and violationDate are required", 400),
    );
  }

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return next(new ApiError("Invalid userId format", 400));
  }

  const doc = await ViolationLog.create({
    userId,
    companyId,
    violationType,
    violationDate,
    minutesLate: minutesLate || 0,
    isExcused: isExcused || false,
    relatedAttendanceId,
  });

  res.status(201).json({
    status: "success",
    message: "Violation log created",
    data: doc,
  });
});

/* =====================================================
   UPDATE
===================================================== */
exports.updateViolationLog = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { id } = req.params;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ApiError("Invalid ID format", 400));
  }

  const { violationType, violationDate, minutesLate, isExcused } = req.body;

  const updates = {};

  if (violationType) updates.violationType = violationType;
  if (violationDate) updates.violationDate = violationDate;
  if (minutesLate !== undefined) updates.minutesLate = minutesLate;
  if (isExcused !== undefined) updates.isExcused = isExcused;

  const doc = await ViolationLog.findOneAndUpdate(
    { _id: id, companyId },
    updates,
    { new: true, runValidators: true },
  );

  if (!doc) {
    return next(new ApiError("Violation log not found", 404));
  }

  res.status(200).json({
    status: "success",
    data: doc,
  });
});

/* =====================================================
   DELETE
===================================================== */
exports.deleteViolationLog = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { id } = req.params;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ApiError("Invalid ID format", 400));
  }

  const doc = await ViolationLog.findOneAndDelete({
    _id: id,
    companyId,
  });

  if (!doc) {
    return next(new ApiError("Violation log not found", 404));
  }

  res.status(200).json({
    status: "success",
    message: "Deleted successfully",
  });
});
