const PayrollEmployeeLine = require("../../../models/Hr/employeePayrollLine.js");

/* =========================================================
   ATTENDANCE CALCULATION
   - Calculate expected hours
   - Calculate actual worked hours
   - Detect shortages / overtime
   - Detect late arrival / early leave
========================================================= */
exports.calculateAttendance = async ({
  employee,
  attendance,
  period,
  payroll,
}) => {
  try {
    /* =====================================================
       1. PREPARE ATTENDANCE DATA
    ===================================================== */
    const sessions = buildAttendanceSessions(attendance || []);

    /* =====================================================
       2. LOAD GROUP SETTINGS
    ===================================================== */
    const group = employee.groupId || {};

    const {
      attendanceType,
      fixedAttendance = {},
      flexibleAttendance = {},
      offDays = [],
      calendarRules = [],
    } = group;

    const requiredHoursPerDay = flexibleAttendance?.requiredHoursPerDay || 0;

    const shiftStart = fixedAttendance?.startTime || null;
    const shiftEnd = fixedAttendance?.endTime || null;

    const earlyInTolerance = fixedAttendance?.earlyIn || 0;

    const earlyOutTolerance = fixedAttendance?.earlyOut || 0;

    const shiftHours = calcShiftHours(shiftStart, shiftEnd);

    /* =====================================================
       3. BUILD PAYROLL PERIOD CALENDAR
    ===================================================== */
    const allDays = buildAllDates(period);

    let workingDays = 0;
    let offDaysCount = 0;
    let holidayDays = 0;

    let lateMinutes = 0;
    let earlyLeaveMinutes = 0;

    /* =====================================================
       4. DETERMINE VALID WORKING DAYS
       Remove:
       - Weekly Off Days
       - Calendar Holidays
    ===================================================== */
    const workingDates = new Set();

    for (const day of allDays) {
      const dateKey = formatDate(day);
      const dayName = getDayName(day);

      const isOffDay = offDays.includes(dayName);

      const isHoliday = calendarRules.some((rule) =>
        matchCalendarRule(rule, day),
      );

      if (isOffDay) {
        offDaysCount++;
        continue;
      }

      if (isHoliday) {
        holidayDays++;
        continue;
      }

      workingDays++;
      workingDates.add(dateKey);
    }

    /* =====================================================
       5. KEEP ONLY SESSIONS INSIDE
       VALID WORKING DAYS
    ===================================================== */
    const workingSessions = sessions.filter((s) =>
      workingDates.has(s.startDate),
    );

    /* =====================================================
       6. CALCULATE ACTUAL WORKED HOURS
    ===================================================== */
    const totalHours = workingSessions.reduce(
      (sum, s) => sum + (s.duration || 0),
      0,
    );

    /* =====================================================
       7. CALCULATE LATE ARRIVAL
       & EARLY LEAVING
       (Fixed Attendance Only)
    ===================================================== */
    if (attendanceType === "fixed") {
      for (const session of workingSessions) {
        if (!shiftStart || !shiftEnd) continue;

        const dateKey = session.startDate;

        const late = diffMinutes(
          `${dateKey}T${shiftStart}`,
          `${dateKey}T${session.startTime}`,
        );

        const earlyLeave = diffMinutes(
          `${dateKey}T${session.endTime}`,
          `${dateKey}T${shiftEnd}`,
        );

        if (late > earlyInTolerance) {
          lateMinutes += late - earlyInTolerance;
        }

        if (earlyLeave > earlyOutTolerance) {
          earlyLeaveMinutes += earlyLeave - earlyOutTolerance;
        }
      }
    }

    /* =====================================================
       8. CALCULATE REQUIRED HOURS
       BASED ON ATTENDANCE TYPE
    ===================================================== */
    let expectedHours = 0;

    if (attendanceType === "fixed") {
      expectedHours = workingDays * shiftHours;
    }

    if (attendanceType === "flexible") {
      expectedHours = workingDays * requiredHoursPerDay;
    }

    if (attendanceType === "remote") {
      expectedHours = workingDays * requiredHoursPerDay;
    }

    /* =====================================================
       9. CALCULATE SHORTAGE / OVERTIME
    ===================================================== */
    const missingHours = Math.max(expectedHours - totalHours, 0);

    const overtimeHours = Math.max(totalHours - expectedHours, 0);

    /* =====================================================
       10. BREAK ANALYSIS
       Used only as an explanation layer.
       Does NOT affect payroll calculations.
    ===================================================== */
    const expectedBreakMinutes = workingDays * 30;

    const gapMinutes = missingHours * 60;

    let breakInsight = {
      status: "confirmed_gap",
      explanation: "actual shortage detected",
    };

    if (gapMinutes > 0 && gapMinutes <= expectedBreakMinutes) {
      breakInsight = {
        status: "likely_break_related",
        explanation: "gap within expected break range",
      };
    }

    if (gapMinutes > expectedBreakMinutes) {
      breakInsight = {
        status: "real_shortage",
        explanation: "gap exceeds possible break time",
      };
    }

    /* =====================================================
       11. BUILD PAYROLL RECORD
    ===================================================== */
    const linePayload = {
      payrollPeriodId: period._id,
      payrollEmployeeId: payroll._id,
      employeeId: employee._id,

      category: "info",
      type: "attendance_summary",
      label: "attendance breakdown",

      amount: 0,
      Originalamount: 0,
      affectsNetSalary: false,
      
      metadata: {
        attendanceType,

        totalHours: round1(totalHours),
        expectedHours: round1(expectedHours),

        missingHours: round1(missingHours),
        overtimeHours: round1(overtimeHours),

        lateMinutes: round1(lateMinutes),
        earlyLeaveMinutes: round1(earlyLeaveMinutes),

        workingDays,
        offDaysCount,
        holidayDays,

        // breakInsight,
      },

      isSystemGenerated: true,
      sourceType: "attendance",
      status: "success",
    };

    /* =====================================================
       12. SAVE RESULT
    ===================================================== */
    const line = await PayrollEmployeeLine.create(linePayload);

    return {
      success: true,
      result: linePayload.metadata,
      linePayload,
      error: null,
    };
  } catch (err) {
    console.log(err);
    
    /* =====================================================
       ERROR HANDLING
    ===================================================== */
    const failureLine = {
      payrollPeriodId: period._id,
      payrollEmployeeId: payroll._id,
      employeeId: employee._id,

      category: "info",
      type: "attendance_failed",
      label: "attendance_error",

      amount: 0,
      Originalamount: 0,

      metadata: {
        error: err.message,
      },

      isSystemGenerated: true,
      status: "failed",
    };

    await PayrollEmployeeLine.create(failureLine);

    return {
      success: false,
      result: null,
      linePayload: failureLine,
      error: err.message,
    };
  }
};
/* =========================================================
   HELPERS
========================================================= */

function round1(n) {
  return Math.round((n || 0) * 10) / 10;
}

function formatDate(date) {
  return new Date(date).toISOString().split("T")[0];
}

function getDayName(date) {
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "long",
  });
}

function diffMinutes(a, b) {
  return (new Date(a) - new Date(b)) / (1000 * 60);
}

function calcShiftHours(start, end) {
  if (!start || !end) return 8;

  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);

  return (eh * 60 + em - (sh * 60 + sm)) / 60;
}

function buildAllDates(period) {
  const days = [];
  let current = new Date(period.startDate);
  const end = new Date(period.endDate);

  while (current <= end) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return days;
}

function buildAttendanceSessions(attendance = []) {
  const normalizeTime = (t) => {
    if (!t) return null;
    if (typeof t !== "string") return null;

    const parts = t.split(":");
    if (parts.length < 2) return null;

    const [h, m, s = "00"] = parts;

    return `${h.padStart(2, "0")}:${m.padStart(2, "0")}:${s.padStart(2, "0")}`;
  };

  const normalizeDate = (d) => {
    if (!d) return null;

    const date = new Date(d);
    if (isNaN(date)) return null;

    return date.toISOString().split("T")[0];
  };

  const getDateTime = (date, time) => {
    const d = normalizeDate(date);
    const t = normalizeTime(time);

    if (!d || !t) return null;

    const dt = new Date(`${d}T${t}`);
    return isNaN(dt) ? null : dt;
  };

  const cleaned = attendance
    .map((r) => {
      const date = normalizeDate(r.date);
      const time = normalizeTime(r.Time || r.time);

      if (!date || !time) return null;

      const dt = getDateTime(date, time);

      return dt ? { ...r, date, Time: time, _dt: dt } : null;
    })
    .filter(Boolean);

  cleaned.sort((a, b) => a._dt - b._dt);

  const sessions = [];
  let checkIn = null;

  for (const r of cleaned) {
    if (r.type?.toLowerCase() === "check-in") {
      checkIn = r;
      continue;
    }

    if (r.type?.toLowerCase() === "check-out") {
      if (!checkIn) continue;

      const start = checkIn._dt;
      const end = r._dt;

      if (!start || !end || end <= start) {
        checkIn = null;
        continue;
      }

      const duration = (end - start) / 3600000;

      sessions.push({
        startDate: checkIn.date,
        startTime: checkIn.Time,
        endDate: r.date,
        endTime: r.Time,
        duration: Number.isFinite(duration) ? duration : 0,
      });

      checkIn = null;
    }
  }

  return sessions;
}

function matchCalendarRule(rule, date, dayName) {
  const d = formatDate(date); // YYYY-MM-DD

  // -------------------------
  // 1. SINGLE_DATE
  // -------------------------
  if (rule.patternType === "SINGLE_DATE") {
    return d === rule.startDate;
  }

  // -------------------------
  // 2. DATE_RANGE
  // -------------------------
  if (rule.patternType === "DATE_RANGE") {
    return d >= rule.startDate && d <= rule.endDate;
  }

  // -------------------------
  // 3. RECURRING_WEEKLY
  // -------------------------
  if (rule.patternType === "RECURRING_WEEKLY") {
    const matchDay = rule.daysOfWeek?.includes(dayName);
    if (!matchDay) return false;

    // optional date boundary
    if (rule.startDate && rule.endDate) {
      return d >= rule.startDate && d <= rule.endDate;
    }

    return true;
  }

  // -------------------------
  // 4. RECURRING_MONTHLY
  // -------------------------
  if (rule.patternType === "RECURRING_MONTHLY") {
    const dayOfMonth = date.getDate();

    const matchDay = rule.dayOfMonth === dayOfMonth;
    if (!matchDay) return false;

    // optional range support
    if (rule.startDate && rule.endDate) {
      return d >= rule.startDate && d <= rule.endDate;
    }

    return true;
  }

  return false;
}
