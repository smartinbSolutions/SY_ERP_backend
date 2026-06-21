const PayrollEmployeeLine = require("../../../models/Hr/employeePayrollLine.js");

/**
 * فلترة السلف حسب الفترة
 */
function filterAdvancesByPeriod(advances, period) {
  const end = new Date(period.endDate);

  return (advances || []).filter((a) => {
    const approvedAt = new Date(a.approvedAt);
    return approvedAt <= end;
  });
}

/**
 * إزالة التكرار (نفس الطلب لا يتكرر داخل payroll)
 */
function uniqueAdvances(advances) {
  const map = new Map();

  for (const a of advances) {
    const key = `${a.userId}-${a.advanceRequestId}`;

    if (!map.has(key)) {
      map.set(key, a);
    }
  }

  return Array.from(map.values());
}


function shouldDeduct(advance, period) {
  const firstDate = advance?.firstDeductionDate;

  if (!firstDate) return true;

  return new Date(period.startDate) >= new Date(firstDate);
}


function getInstallmentAmount(advance) {
  // الحالة 1: موجودة مباشرة من aggregation
  if (advance?.installmentAmount) {
    return advance.installmentAmount;
  }

  // الحالة 2: fallback
  if (advance?.approvedAmount && advance?.installments) {
    return advance.approvedAmount / advance.installments;
  }

  return 0;
}

/**
 * MAIN ADVANCE CALCULATION ENGINE
 */
exports.CalculateAdvances = async ({ employee, advances, period, payroll }) => {
  try {
    console.log("\n===== ADVANCE ENGINE START =====");
    console.log("Employee ID:", employee?._id);
    console.log("Advances input:", advances?.length || 0);
    console.log("Period:", period);

    // =========================
    // 1. FILTER BY PERIOD
    // =========================
    const filtered = filterAdvancesByPeriod(advances, period);
    console.log("After filter:", filtered.length);

    // =========================
    // 2. REMOVE DUPLICATES
    // =========================
    const unique = uniqueAdvances(filtered);
    console.log("After dedup:", unique.length);

    let totalDeduction = 0;
    const createdLines = [];

    // =========================
    // 3. LOOP ADVANCES
    // =========================
    for (const advance of unique) {
      const installmentAmount = getInstallmentAmount(advance);
      const allowDeduction = shouldDeduct(advance, period);

      console.log("\n--- ADVANCE ITEM ---");
      console.log("userId:", advance?.userId);
      console.log("requestId:", advance?.advanceRequestId);
      console.log("approvedAt:", advance?.approvedAt);
      console.log("installmentAmount:", installmentAmount);
      console.log("shouldDeduct:", allowDeduction);

      // =========================
      // ELIGIBILITY CHECK
      // =========================
      if (!allowDeduction) continue;
      if (!installmentAmount || installmentAmount <= 0) continue;

      // =========================
      // CREATE PAYROLL LINE
      // =========================
      const linePayload = {
        payrollPeriodId: period._id,
        payrollEmployeeId: payroll._id,
        employeeId: employee._id,

        category: "deduction",
        type: "advance_installment",
        label: "advance_installment",

        quantity: 1,
        unit: "installment",

        rate: installmentAmount,
        amount: installmentAmount,
        Originalamount: installmentAmount,

        sourceType: "advance",
        sourceId: advance._id,
        sourceRef: advance.advanceRequestId,
        isSystemGenerated: true,
        status: "success",
      };

      const created = await PayrollEmployeeLine.create(linePayload);

      createdLines.push(created);
      totalDeduction += installmentAmount;
    }

    console.log("\n===== ADVANCE ENGINE END =====");
    console.log("Total deduction:", totalDeduction);
    console.log("Lines:", createdLines.length);

   return {
  success: true,

  result: {
    amount: totalDeduction,
    linesCount: createdLines.length,
    lines: createdLines,
  },
};
  } catch (err) {
    console.log("ADVANCE ENGINE ERROR:", err.message);

    const failureLine = await PayrollEmployeeLine.create({
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
    });

    return {
      success: false,
      amount: 0,
      error: err.message,
      line: failureLine,
    };
  }
};
