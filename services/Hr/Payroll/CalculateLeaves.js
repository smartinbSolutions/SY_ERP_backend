const PayrollEmployeeLine = require("../../../models/Hr/employeePayrollLine.js");

/**
 * 1. فلترة الإجازات ضمن فترة الرواتب
 */
function filterLeavesByPeriod(leaves, period) {
  const start = new Date(period.startDate);
  const end = new Date(period.endDate);

  return (leaves || []).filter((l) => {
    const leaveStart = new Date(l.startDate);
    const leaveEnd = new Date(l.endDate);

    return leaveEnd >= start && leaveStart <= end;
  });
}

/**
 * 2. دمج الإجازات المتداخلة
 */
function mergeLeaves(leaves) {
  if (!leaves.length) return [];

  const sorted = [...leaves].sort(
    (a, b) => new Date(a.startDate) - new Date(b.startDate),
  );

  const merged = [];
  let current = {
    start: new Date(sorted[0].startDate),
    end: new Date(sorted[0].endDate),
  };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];

    const nextStart = new Date(next.startDate);
    const nextEnd = new Date(next.endDate);

    if (nextStart <= current.end) {
      current.end = new Date(Math.max(current.end, nextEnd));
    } else {
      merged.push(current);
      current = { start: nextStart, end: nextEnd };
    }
  }

  merged.push(current);
  return merged;
}

/**
 * 3. الحساب
 */
function computeLeaves(leaves, employee, period) {
  const filtered = filterLeavesByPeriod(leaves, period);
  const merged = mergeLeaves(filtered);

  const sessions = merged.map((l) => {
    const days = Math.floor((l.end - l.start) / (1000 * 60 * 60 * 24)) + 1;

    return {
      startDate: l.start,
      endDate: l.end,
      days: Math.max(days, 0),
    };
  });

  const totalDays = sessions.reduce((s, x) => s + x.days, 0);

  const workingDaysPerMonth = 30;
  const dailyRate = (employee.salary || 0) / workingDaysPerMonth;

  const amount = totalDays * dailyRate;

  return {
    sessions,
    totalDays,
    dailyRate,
    amount,
  };
}

/**
 * 4. MAIN FUNCTION (WITH LINE CREATION)
 */
exports.CalculateLeaves = async ({
  employee,
  leaves,
  period,
  payroll,
}) => {
  try {
    // =========================
    // 1. CALCULATION
    // =========================
    const result = computeLeaves(leaves || [], employee, period);

    // =========================
    // 2. LINE PAYLOAD
    // =========================
    const linePayload = {
      payrollPeriodId: period._id,
      payrollEmployeeId: payroll._id,
      employeeId: employee._id,

      category: "deduction",
      type: "unpaid_leave_deduction",
      label: "leaves",

      quantity: result.totalDays,
      unit: "day",
      rate: result.dailyRate,

      amount: result.amount,

      sourceType: "leave_request",
      isSystemGenerated: true,

      status: "success",
    };

    // =========================
    // 3. DB WRITE (ONLY ON SUCCESS)
    // =========================
    const createdLine = await PayrollEmployeeLine.create(linePayload);

    return {
      success: true,
      result,
      linePayload: createdLine,
    };
  } catch (err) {
    // =========================
    // 4. FAILURE LINE
    // =========================
    const failureLine = {
      payrollPeriodId: period._id,
      payrollEmployeeId: payroll._id,
      employeeId: employee._id,

      category: "info",
      type: "manual_adjustment",
      label: "leave_failed",

      amount: 0,

      status: "failed",
      errorMessage: err.message,

      isSystemGenerated: true,
    };

    const createdFailure = await PayrollEmployeeLine.create(failureLine);

    return {
      success: false,
      result: null,
      linePayload: createdFailure,
      error: err.message,
    };
  }
};
