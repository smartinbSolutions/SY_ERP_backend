import PayrollEmployeeLine from "../../../models/Hr/employeePayrollLine.js";

/**
 * 1. فلترة الأوفر تايم ضمن الفترة
 */
function filterOvertimeByPeriod(overtime, period) {
  const start = new Date(period.startDate);
  const end = new Date(period.endDate);

  return (overtime || []).filter(o => {
    const d = new Date(o.approvedAt);
    return d >= start && d <= end;
  });
}

/**
 * 2. تجميع حسب النوع
 */
function groupByType(overtime) {
  const map = new Map();

  for (const item of overtime) {
    const key = item.overtimeType?.toString?.() || "unknown";

    if (!map.has(key)) {
      map.set(key, []);
    }

    map.get(key).push(item);
  }

  return map;
}

/**
 * 3. حساب الأوفر تايم
 * ⚠️ حالياً نفترض 2 ساعات لكل request (placeholder business rule)
 */
function computeOvertime(overtime, employee) {
  const HOURLY_RATE = (employee.salary || 0) / 160;

  const HOURS_PER_REQUEST = 2; // ⚠️ لازم تربطها لاحقاً بـ overtimeType

  const groups = groupByType(overtime);

  const breakdown = [];
  let totalHours = 0;
  let totalAmount = 0;

  for (const [type, items] of groups.entries()) {
    const hours = items.length * HOURS_PER_REQUEST;
    const amount = hours * HOURLY_RATE;

    totalHours += hours;
    totalAmount += amount;

    breakdown.push({
      overtimeType: type,
      requests: items.length,
      hours,
      rate: HOURLY_RATE,
      amount,
    });
  }

  return {
    breakdown,
    totalHours,
    hourlyRate: HOURLY_RATE,
    amount: totalAmount,
  };
}

/**
 * 4. MAIN FUNCTION
 */
export const CalculateOvertime = async ({
  employee,
  overtime,
  period,
  payroll,
}) => {
  try {
    // =========================
    // 1. FILTER
    // =========================
    const filtered = filterOvertimeByPeriod(overtime || [], period);

    // =========================
    // 2. CALCULATION
    // =========================
    const result = computeOvertime(filtered, employee);

    // إذا ما في أوفر تايم
    if (!filtered.length) {
      return {
        success: true,
        result: {
          totalHours: 0,
          amount: 0,
          breakdown: [],
        },
        linePayload: null,
      };
    }

    // =========================
    // 3. LINE PAYLOAD (ONE LINE PER EMPLOYEE)
    // =========================
    const linePayload = {
      payrollPeriodId: period._id,
      payrollEmployeeId: payroll._id,
      employeeId: employee._id,

      category: "earning",
      type: "overtime",
      label: "overtime",

      quantity: result.totalHours,
      unit: "hour",
      rate: result.hourlyRate,

      amount: result.amount,

      sourceType: "overtime_request",
      isSystemGenerated: true,

      status: "success",
    };

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
      label: "overtime_failed",

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