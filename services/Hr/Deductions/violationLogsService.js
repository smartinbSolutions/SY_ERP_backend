const mongoose = require("mongoose");
const ViolationLog = require("../../../models/Hr/Deductions/violationLogModel");
const staffModel = require("../../../models/Hr/Staffs/staffModel");
const fingerprintModel = require("../../../models/Hr/Attendance/fingerprintModel");
const leavesLogsModel = require("../../../models/Hr/Leaves/leavesLogsModel");
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

// Check whether a calendar rule makes the selected date a full day off
const isCalendarRuleActive = (rule, date) => {
  if (!rule) return false;

  if (rule.effectType !== "FULL_DAY_OFF") {
    return false;
  }

  if (rule.patternType === "SINGLE_DATE") {
    return date === rule.startDate;
  }

  if (rule.patternType === "DATE_RANGE") {
    return date >= rule.startDate && date <= rule.endDate;
  }

  if (rule.patternType === "RECURRING_WEEKLY") {
    if (date < rule.startDate || date > rule.endDate) {
      return false;
    }

    const dayName = dayjs(date).format("dddd");

    return rule.daysOfWeek?.includes(dayName) ?? false;
  }

  if (rule.patternType === "RECURRING_MONTHLY") {
    return false;
  }

  return false;
};

const processDailyAbsenceViolationsService = async () => {
  // The job runs at midnight, so process the previous day
  const targetDate = dayjs().subtract(1, "day").format("YYYY-MM-DD");

  const dayName = dayjs(targetDate).format("dddd");

  // =====================================================
  // Load active employees
  // =====================================================

  const staffList = await staffModel
    .find({
      employmentStatus: true,
    })
    .populate("groupId");

  if (!staffList.length) {
    return;
  }

  // =====================================================
  // Group employees by company
  // =====================================================

  const companyStaffMap = new Map();

  for (const staff of staffList) {
    if (!staff.companyId) {
      continue;
    }

    if (!companyStaffMap.has(staff.companyId)) {
      companyStaffMap.set(staff.companyId, []);
    }

    companyStaffMap.get(staff.companyId).push(staff);
  }

  // =====================================================
  // Process each company independently
  // =====================================================

  for (const [companyId, companyStaff] of companyStaffMap) {
    // ---------------------------------------------------
    // Load leaves for this company
    // ---------------------------------------------------

    const leaves = await leavesLogsModel.find({
      companyId,
      startDate: { $lte: targetDate },
      endDate: { $gte: targetDate },
    });

    // ---------------------------------------------------
    // Load fingerprints for this company
    // ---------------------------------------------------

    const fingerprints = await fingerprintModel.find({
      companyId,
      date: targetDate,
    });

    // ---------------------------------------------------
    // Create lookup maps
    // ---------------------------------------------------

    const leaveSet = new Set(
      leaves
        .filter((leave) => leave.userId)
        .map((leave) => leave.userId.toString()),
    );

    const fingerprintMap = new Map();

    fingerprints.forEach((fingerprint) => {
      if (fingerprint.userID) {
        fingerprintMap.set(fingerprint.userID.toString(), true);
      }
    });

    // ===================================================
    // Process employees of this company
    // ===================================================

    for (const staff of companyStaff) {
      const userIdStr = staff._id.toString();
      const group = staff.groupId;

      if (!group) {
        continue;
      }

      // -------------------------------------------------
      // Employees with approved leave are excluded
      // -------------------------------------------------

      const hasLeave = leaveSet.has(userIdStr);

      if (hasLeave) {
        continue;
      }

      // -------------------------------------------------
      // Employees with any fingerprint are excluded
      // -------------------------------------------------

      const hasFingerprint = fingerprintMap.has(userIdStr);

      if (hasFingerprint) {
        continue;
      }

      // -------------------------------------------------
      // Weekly off days are excluded
      // -------------------------------------------------

      const isOffDay = group.offDays?.includes(dayName);

      if (isOffDay) {
        continue;
      }

      // -------------------------------------------------
      // Calendar holidays are excluded
      // -------------------------------------------------

      const isHoliday = group.calendarRules?.some((rule) =>
        isCalendarRuleActive(rule, targetDate),
      );

      if (isHoliday) {
        continue;
      }

      // -------------------------------------------------
      // Prevent duplicate absence violations
      // -------------------------------------------------

      const existing = await ViolationLog.findOne({
        userId: staff._id,
        companyId: staff.companyId,
        violationDate: targetDate,
        violationType: "absence",
      });

      if (existing) {
        continue;
      }

      // -------------------------------------------------
      // Create and process absence violation
      // -------------------------------------------------

      await createViolationAndProcess({
        userId: staff._id,
        companyId: staff.companyId,
        violationType: "absence",
        violationDate: targetDate,
        isExcused: false,
      });
    }
  }
};

module.exports = {
  getAllViolationLogsService,
  getViolationTotalsService,
  deleteViolationLogService,
  processDailyAbsenceViolationsService,
};
