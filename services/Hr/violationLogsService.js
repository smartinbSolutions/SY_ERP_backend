const mongoose = require("mongoose");
const ViolationLog = require("../../models/Hr/violationLogModel");
const staffModel = require("../../models/Hr/staffModel");
const fingerprintModel = require("../../models/Hr/fingerprintModel");
const leavesLogsModel = require("../../models/Hr/Leaves/leavesLogsModel");
const dayjs = require("dayjs");
const { createViolationAndProcess } = require("./violationProcessor");

/* =====================================================
   GET ALL LOGS (PURE SERVICE)
===================================================== */
const getAllViolationLogsService = async ({
  companyId,
  userId,
  violationType,
  page = 1,
  limit = 10,
}) => {
  const query = { companyId };

  if (userId) query.userId = userId;
  if (violationType) query.violationType = violationType;

  const skip = (page - 1) * limit;

  const total = await ViolationLog.countDocuments(query);

  const data = await ViolationLog.find(query)
    .skip(skip)
    .limit(limit)
    .sort({ violationDate: -1 });

  return {
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results: data.length,
    data,
  };
};

/* =====================================================
   GET VIOLATION TOTALS (PURE SERVICE)
===================================================== */
const getViolationTotalsService = async ({ userId, companyId, from, to }) => {
  const logs = await ViolationLog.find({
    userId: new mongoose.Types.ObjectId(userId),
    companyId,
    isExcused: false,
    violationDate: {
      $gte: new Date(from),
      $lte: new Date(to),
    },
  })
    .select("violationType minutesLate violationDate")
    .lean();

  const totals = {
    late: 0,
    severe_late: 0,
    absence: 0,
    early_leave: 0,
    no_punch: 0,
  };

  for (const log of logs) {
    if (totals[log.violationType] !== undefined) {
      totals[log.violationType]++;
    }
  }

  return {
    logs,
    totals,
  };
};

/* =====================================================
   DELETE LOG (SERVICE)
===================================================== */
const deleteViolationLogService = async ({ id, companyId }) => {
  const doc = await ViolationLog.findOneAndDelete({
    _id: id,
    companyId,
  });

  return doc;
};

/* =====================================================
   PROCESS ABSENCE JOB (KEEP AS SERVICE)
===================================================== */
const processDailyAbsenceViolationsService = async () => {

  const today = dayjs().format("YYYY-MM-DD");
  const dayName = dayjs(today).format("dddd");

  /* ===============================
     1. STAFF
  =============================== */
  const staffList = await staffModel
    .find({ employmentStatus: true })
    .populate("groupId");

  if (!staffList.length) {
    console.log("⚠️ No staff found");
    return;
  }

  const companyId = staffList[0].companyId;

  /* ===============================
     2. LEAVES
  =============================== */
  const leaves = await leavesLogsModel.find({
    companyId,
    startDate: { $lte: today },
    endDate: { $gte: today },
  });

  /* ===============================
     3. FINGERPRINTS
  =============================== */
  const fingerprints = await fingerprintModel.find({
    companyId,
    date: today,
  });

  /* ===============================
     4. LOOKUPS
  =============================== */
  const leaveSet = new Set(leaves.map((l) => l.userId.toString()));

  const fingerprintMap = new Map();
  fingerprints.forEach((fp) => {
    if (fp.userID) {
      fingerprintMap.set(fp.userID.toString(), true);
    }
  });

  /* ===============================
     5. PROCESS STAFF
  =============================== */
  let createdCount = 0;
  let skippedLeave = 0;
  let skippedFingerprint = 0;
  let skippedOffDay = 0;
  let skippedHoliday = 0;
  let skippedExisting = 0;

  for (const staff of staffList) {
    const group = staff.groupId;
    if (!group) continue;

    const userIdStr = staff._id.toString();

    // LEAVE
    if (leaveSet.has(userIdStr)) {
      skippedLeave++;
      continue;
    }

    // FINGERPRINT
    if (fingerprintMap.has(userIdStr)) {
      skippedFingerprint++;
      continue;
    }

    // OFF DAY
    const isOffDay = group.offDays?.includes(dayName);
    if (isOffDay) {
      skippedOffDay++;
      continue;
    }

    // HOLIDAY
    const isHoliday = group.calendarRules?.some(
      (r) =>
        r.effectType === "FULL_DAY_OFF" &&
        today >= r.startDate &&
        today <= r.endDate,
    );

    if (isHoliday) {
      skippedHoliday++;
      continue;
    }

    // EXISTING VIOLATION
    const existing = await ViolationLog.findOne({
      userId: staff._id,
      violationDate: today,
      violationType: "absence",
    });

    if (existing) {
      skippedExisting++;
      continue;
    }

    // CREATE VIOLATION
    await createViolationAndProcess({
      userId: staff._id,
      companyId: staff.companyId,
      violationType: "absence",
      violationDate: today,
      isExcused: false,
    });

    createdCount++;
  }

  /* ===============================
     FINAL REPORT
  =============================== */
  console.log("📊 Absence job result:");
  console.log("✅ Created:", createdCount);
  console.log("🌴 Leave skipped:", skippedLeave);
  console.log("🖐 Fingerprint skipped:", skippedFingerprint);
  console.log("📅 Off day skipped:", skippedOffDay);
  console.log("🎉 Holiday skipped:", skippedHoliday);
  console.log("♻️ Existing skipped:", skippedExisting);

  console.log("🏁 Absence job finished\n");
};

module.exports = {
  getAllViolationLogsService,
  getViolationTotalsService,
  deleteViolationLogService,
  processDailyAbsenceViolationsService,
};
