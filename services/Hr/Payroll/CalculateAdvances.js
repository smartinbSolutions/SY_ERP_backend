import PayrollEmployeeLine from "../../../models/Hr/employeePayrollLine.js";

/**
 * 1. فلترة السلف ضمن فترة الرواتب
 */
function filterAdvancesByPeriod(advances, period) {
  const start = new Date(period.startDate);
  const end = new Date(period.endDate);

  return (advances || []).filter(a => {
    const approved = new Date(a.approvedAt);
    return approved >= start && approved <= end;
  });
}

/**
 * 2. إزالة التكرار (مهم جداً لمنع double deduction)
 */
function uniqueAdvances(advances) {
  const map = new Map();

  for (const a of advances) {
    const key = `${a.userId}-${a.advanceTypeId}`;

    if (!map.has(key)) {
      map.set(key, a);
    }
  }

  return Array.from(map.values());
}

/**
 * 3. حساب السلف
 * ⚠️ هنا أهم نقطة: لا يوجد amount في الداتا → لازم policy
 */
function computeAdvances(advances, employee) {
  const ADVANCE_DEFAULT_AMOUNT = 100; // fallback آمن

  const breakdown = advances.map(a => {
    const amount = a.amount || ADVANCE_DEFAULT_AMOUNT;

    return {
      advanceTypeId: a.advanceTypeId,
      amount,
    };
  });

  const totalAmount = breakdown.reduce((sum, x) => sum + x.amount, 0);

  return {
    breakdown,
    totalAmount,
  };
}

/**
 * 4. MAIN FUNCTION
 */
export const CalculateAdvances = async ({
  employee,
  advances,
  period,
  payroll,
}) => {
  try {
    // =========================
    // 1. FILTER
    // =========================
    const filtered = filterAdvancesByPeriod(advances, period);

    // =========================
    // 2. UNIQUE
    // =========================
    const unique = uniqueAdvances(filtered);

    // =========================
    // 3. CALCULATION
    // =========================
    const result = computeAdvances(unique, employee);

    // إذا لا يوجد سلف
    if (!unique.length) {
      return {
        success: true,
        result: {
          totalAmount: 0,
          breakdown: [],
        },
        linePayload: null,
      };
    }

    // =========================
    // 4. LINE PAYLOAD
    // =========================
    const linePayload = {
      payrollPeriodId: period._id,
      payrollEmployeeId: payroll._id,
      employeeId: employee._id,

      category: "deduction",
      type: "loan_installment",
      label: "advances",

      quantity: unique.length,
      unit: "fixed",
      rate: null,

      amount: result.totalAmount,

      sourceType: "loan",
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
    // 5. FAILURE LINE
    // =========================
    const failureLine = {
      payrollPeriodId: period._id,
      payrollEmployeeId: payroll._id,
      employeeId: employee._id,

      category: "info",
      type: "manual_adjustment",
      label: "advances_failed",

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