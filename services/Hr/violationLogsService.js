const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const ViolationLog = require("../../models/Hr/violationLogModel");
const mongoose = require("mongoose");
const staffModel = require("../../models/Hr/staffModel");
const fingerprintModel = require("../../models/Hr/fingerprintModel");
const leavesLogsModel = require("../../models/Hr/leavesLogsModel");
const dayjs = require("dayjs");

function getDayName(dateString) {
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  const date = new Date(dateString);
  return days[date.getDay()];
}

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
  const today = dayjs().format("YYYY-MM-DD");

  console.log("\n🟡 [ABSENCE JOB START]");
  console.log("📅 Today:", today);

  // =====================================================
  // 1. GET STAFF
  // =====================================================
  const staffList = await staffModel
    .find({ employmentStatus: true })
    .populate("groupId");

  console.log(`👥 Staff loaded: ${staffList.length}`);

  if (!staffList.length) {
    console.log("⚠️ No staff found → EXIT");
    return;
  }

  const companyId = staffList[0].companyId;
  console.log("🏢 Company ID:", companyId);

  // =====================================================
  // 2. BULK FETCH LEAVES
  // =====================================================
  console.log("\n📦 Fetching leaves...");

  const leaves = await leavesLogsModel.find({
    companyId,
    status: "approved",
    startDate: { $lte: today },
    endDate: { $gte: today },
  });

  console.log("📦 Leaves found:", leaves.length);

  leaves.forEach((l, i) => {
    console.log(`   🏖 Leave ${i + 1}:`, {
      userId: l.userId,
      startDate: l.startDate,
      endDate: l.endDate,
    });
  });

  // =====================================================
  // 3. BULK FETCH FINGERPRINTS
  // =====================================================
  console.log("\n📦 Fetching fingerprints...");

  const fingerprints = await fingerprintModel.find({
    companyId,
    date: today,
  });

  console.log("📦 Fingerprints found:", fingerprints.length);

  fingerprints.forEach((f, i) => {
    console.log(`   🧾 FP ${i + 1}:`, {
      userID: f.userID,
      type: f.type,
      time: f.Time,
    });
  });

  // =====================================================
  // 4. LOOP STAFF
  // =====================================================
  for (const staff of staffList) {
    console.log("\n--------------------------------------------------");

    console.log("👤 STAFF CHECK:", {
      id: staff._id,
      name: staff.fullName,
    });

    const group = staff.groupId;

    if (!group) {
      console.log("⚠️ No group assigned → SKIP STAFF");
      continue;
    }

    console.log("📊 Group:", {
      id: group._id,
      offDays: group.offDays,
    });

    // =====================================================
    // 5. LEAVE CHECK
    // =====================================================
    console.log("🔎 Checking leave...");

    const hasLeave = leaves.find((l) => l.userId.equals(staff._id));

    console.log("🏖 Leave result:", hasLeave ? "YES (ON LEAVE)" : "NO");

    if (hasLeave) {
      console.log("⏭️ SKIP → staff on leave");
      continue;
    }

    // =====================================================
    // 6. FINGERPRINT CHECK
    // =====================================================
    console.log("🔎 Checking fingerprint...");

const fp = fingerprints.find((f) =>
  f.userID && f.userID.toString() === staff._id.toString()
);
    console.log("🧾 Fingerprint result:", fp ? "FOUND" : "NOT FOUND");

    if (fp) {
      console.log("🟢 PRESENT → SKIP ABSENCE");
      continue;
    }

    console.log("🔴 No fingerprint → potential absence");

    // =====================================================
    // 7. OFF DAY CHECK
    // =====================================================
    const dayName = getDayName(today);

    console.log("📆 Today is:", dayName);

    const isOffDay = group.offDays?.includes(dayName);

    console.log("🛑 Off day check:", isOffDay);

    if (isOffDay) {
      console.log("⏭️ SKIP → off day");
      continue;
    }

    // =====================================================
    // 8. HOLIDAY CHECK
    // =====================================================
    console.log("🏖 Checking holiday rules...");

    const isHoliday = group.calendarRules?.some((rule) => {
      const match =
        rule.effectType === "holiday" &&
        today >= rule.startDate &&
        today <= rule.endDate;

      if (match) {
        console.log("🎯 Holiday matched rule:", rule);
      }

      return match;
    });

    console.log("🏖 Holiday result:", isHoliday);

    if (isHoliday) {
      console.log("⏭️ SKIP → holiday");
      continue;
    }

    // =====================================================
    // 9. DUPLICATE CHECK
    // =====================================================
    console.log("🔎 Checking existing violation...");

    const existing = await ViolationLog.findOne({
      userId: staff._id,
      violationDate: today,
      violationType: "absence",
    });

    console.log("🧾 Existing violation:", existing ? "YES" : "NO");

    if (existing) {
      console.log("⏭️ SKIP → already exists");
      continue;
    }

    // =====================================================
    // 10. CREATE VIOLATION
    // =====================================================
    console.log("🚨 Creating absence violation...");

    const violation = await ViolationLog.create({
      userId: staff._id,
      companyId: staff.companyId,
      violationType: "absence",
      violationDate: today,
      isExcused: false,
    });

    console.log("✅ CREATED:", violation._id);
  }

  console.log("\n🟢 [ABSENCE JOB END]");
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
