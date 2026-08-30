require("dotenv").config({
  path: "config.env",
});

const mongoose = require("mongoose");
const dayjs = require("dayjs");

const staffModel = require("../models/Hr/Staffs/staffModel");
const fingerprintModel = require("../models/Hr/Attendance/fingerprintModel");
const leavesLogsModel = require("../models/Hr/Leaves/leavesLogsModel");
const ViolationLog = require("../models/Hr/Deductions/violationLogModel");

const {
  createViolationAndProcess,
} = require("../services/Hr/Deductions/violationProcessor");

// =====================================================
// CONFIG
// =====================================================

const FROM_DATE = "2026-08-01";
const TO_DATE = "2026-08-29";

// =====================================================
// CALENDAR RULE
// نفس منطق الـ Cron
// =====================================================

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

// =====================================================
// PROCESS ONE DATE
// =====================================================

const processAbsenceForDate = async (targetDate) => {
  const dayName = dayjs(targetDate).format("dddd");

  console.log("\n==========================================");
  console.log(`PROCESSING DATE: ${targetDate}`);
  console.log("==========================================");

  // ===================================================
  // 1. Load active employees
  // ===================================================

  const staffList = await staffModel
    .find({
      employmentStatus: true,
    })
    .populate("groupId")
    .lean();

  if (!staffList.length) {
    console.log("No active employees found.");

    return {
      processed: 0,
      created: 0,
      skipped: 0,
    };
  }

  // ===================================================
  // 2. Group employees by company
  // ===================================================

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

  console.log(`Companies found: ${companyStaffMap.size}`);

  // ===================================================
  // Statistics
  // ===================================================

  let totalProcessed = 0;
  let totalCreated = 0;
  let totalSkipped = 0;

  // ===================================================
  // 3. Process each company independently
  // ===================================================

  for (const [companyId, companyStaff] of companyStaffMap) {
    console.log("\n------------------------------------------");
    console.log(`COMPANY: ${companyId}`);
    console.log(`Employees: ${companyStaff.length}`);
    console.log("------------------------------------------");

    // -------------------------------------------------
    // Load leaves ONLY for this company
    // -------------------------------------------------

    const leaves = await leavesLogsModel
      .find({
        companyId,
        startDate: {
          $lte: targetDate,
        },
        endDate: {
          $gte: targetDate,
        },
      })
      .lean();

    // -------------------------------------------------
    // Load fingerprints ONLY for this company
    // -------------------------------------------------

    const fingerprints = await fingerprintModel
      .find({
        companyId,
        date: targetDate,
      })
      .lean();

    console.log(`Leaves: ${leaves.length}`);

    console.log(`Fingerprints: ${fingerprints.length}`);

    // -------------------------------------------------
    // Leave Set
    // -------------------------------------------------

    const leaveSet = new Set(
      leaves
        .filter((leave) => leave.userId)
        .map((leave) => leave.userId.toString()),
    );

    // -------------------------------------------------
    // Fingerprint Set
    // -------------------------------------------------

    const fingerprintSet = new Set(
      fingerprints
        .filter((fingerprint) => fingerprint.userID)
        .map((fingerprint) => fingerprint.userID.toString()),
    );

    // =================================================
    // 4. Process employees of this company
    // =================================================

    for (const staff of companyStaff) {
      totalProcessed++;

      const userIdStr = staff._id.toString();

      const group = staff.groupId;

      // ------------------------------------------------
      // No Group
      // ------------------------------------------------

      if (!group) {
        totalSkipped++;

        console.log(`SKIP | ${staff.fullName || userIdStr} | NO_GROUP`);

        continue;
      }

      // ------------------------------------------------
      // Leave
      // ------------------------------------------------

      const hasLeave = leaveSet.has(userIdStr);

      if (hasLeave) {
        totalSkipped++;

        console.log(`SKIP | ${staff.fullName || userIdStr} | LEAVE`);

        continue;
      }

      // ------------------------------------------------
      // Fingerprint
      // ------------------------------------------------

      const hasFingerprint = fingerprintSet.has(userIdStr);

      if (hasFingerprint) {
        totalSkipped++;

        console.log(`SKIP | ${staff.fullName || userIdStr} | FINGERPRINT`);

        continue;
      }

      // ------------------------------------------------
      // Weekly Off Day
      // ------------------------------------------------

      const isOffDay = group.offDays?.includes(dayName);

      if (isOffDay) {
        totalSkipped++;

        console.log(`SKIP | ${staff.fullName || userIdStr} | OFF_DAY`);

        continue;
      }

      // ------------------------------------------------
      // Calendar Holiday
      // ------------------------------------------------

      const isHoliday = group.calendarRules?.some((rule) =>
        isCalendarRuleActive(rule, targetDate),
      );

      if (isHoliday) {
        totalSkipped++;

        console.log(`SKIP | ${staff.fullName || userIdStr} | HOLIDAY`);

        continue;
      }

      // ------------------------------------------------
      // Existing Absence
      // ------------------------------------------------

      const existing = await ViolationLog.findOne({
        userId: staff._id,
        companyId: staff.companyId,
        violationDate: targetDate,
        violationType: "absence",
      }).lean();

      if (existing) {
        totalSkipped++;

        console.log(`SKIP | ${staff.fullName || userIdStr} | ALREADY_EXISTS`);

        continue;
      }

      // ------------------------------------------------
      // Create + Process Violation
      // ------------------------------------------------

      await createViolationAndProcess({
        userId: staff._id,
        companyId: staff.companyId,
        violationType: "absence",
        violationDate: targetDate,
        isExcused: false,
      });

      totalCreated++;

      console.log(`CREATED | ${staff.fullName || userIdStr} | ABSENCE`);
    }
  }

  console.log("\n==========================================");
  console.log(`DATE COMPLETED: ${targetDate}`);
  console.log(`Processed: ${totalProcessed}`);
  console.log(`Created: ${totalCreated}`);
  console.log(`Skipped: ${totalSkipped}`);
  console.log("==========================================");

  return {
    processed: totalProcessed,
    created: totalCreated,
    skipped: totalSkipped,
  };
};

// =====================================================
// MAIN
// =====================================================

const run = async () => {
  try {
    console.log("\n==========================================");

    console.log("STARTING AUGUST ABSENCE BACKFILL");

    console.log(`FROM: ${FROM_DATE}`);

    console.log(`TO:   ${TO_DATE}`);

    console.log("==========================================\n");

    // =================================================
    // MongoDB
    // =================================================

    if (!process.env.DB_URI) {
      throw new Error("MONGO_URI is not defined in config.env");
    }

    await mongoose.connect(process.env.DB_URI);

    console.log("MongoDB connected.");
    
    // =================================================
    // Validate dates
    // =================================================

    let currentDate = dayjs(FROM_DATE);

    const endDate = dayjs(TO_DATE);

    if (!currentDate.isValid()) {
      throw new Error(`Invalid FROM_DATE: ${FROM_DATE}`);
    }

    if (!endDate.isValid()) {
      throw new Error(`Invalid TO_DATE: ${TO_DATE}`);
    }

    if (currentDate.isAfter(endDate, "day")) {
      throw new Error("FROM_DATE cannot be after TO_DATE");
    }

    // =================================================
    // Global Statistics
    // =================================================

    let totalProcessed = 0;
    let totalCreated = 0;
    let totalSkipped = 0;
    let daysProcessed = 0;

    // =================================================
    // Process dates chronologically
    // =================================================

    while (
      currentDate.isBefore(endDate, "day") ||
      currentDate.isSame(endDate, "day")
    ) {
      const targetDate = currentDate.format("YYYY-MM-DD");

      const result = await processAbsenceForDate(targetDate);

      totalProcessed += result.processed;

      totalCreated += result.created;

      totalSkipped += result.skipped;

      daysProcessed++;

      // Next date only after current date
      // has completely finished
      currentDate = currentDate.add(1, "day");
    }

    // =================================================
    // Final Summary
    // =================================================

    console.log("\n==========================================");

    console.log("ABSENCE BACKFILL COMPLETED");

    console.log("==========================================");

    console.log(`Days processed: ${daysProcessed}`);

    console.log(`Employees processed: ${totalProcessed}`);

    console.log(`Absences created: ${totalCreated}`);

    console.log(`Skipped: ${totalSkipped}`);

    console.log("==========================================\n");
  } catch (error) {
    console.error("\n==========================================");

    console.error("ABSENCE BACKFILL FAILED");

    console.error(error);

    console.error("==========================================\n");

    process.exitCode = 1;
  } finally {
    try {
      await mongoose.disconnect();

      console.log("MongoDB disconnected.");
    } catch (error) {
      console.error("MongoDB disconnect failed:", error);
    }
  }
};

// =====================================================
// RUN
// =====================================================

run();
