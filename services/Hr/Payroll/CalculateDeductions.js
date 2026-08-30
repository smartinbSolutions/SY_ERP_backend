const PayrollEmployeeLine = require("../../../models/Hr/Payrolls/employeePayrollLine");

exports.CalculateDeductions = async ({
  employee,
  deductions = [],
  period,
  payroll,
}) => {
  try {
    if (!deductions.length) {
      return {
        success: true,
        result: {
          totalAmount: 0,
        },
        linePayload: null,
      };
    }

    const hourlyRate = Number(employee.salary.hourlyRate || 0);

    const shiftHours = getShiftHours(employee);

    let totalAmount = 0;

    let totalDeductionHours = 0;

    let totalFixedAmount = 0;

    const breakdown = deductions.map((item) => {
      const unit = item.deduction?.unit;
      const value = Number(item.deduction?.value || 0);

      console.log("item", item);

      let amount = 0;
      let deductionHours = 0;

      // =========================
      // SAME CALCULATION LOGIC
      // =========================
      switch (unit) {
        case "minutes":
          deductionHours = value / 60;
          amount = Number((deductionHours * hourlyRate).toFixed(2));
          break;

        case "hour":
          deductionHours = value;
          amount = Number((value * hourlyRate).toFixed(2));
          break;

        case "day":
          deductionHours = value * shiftHours;
          amount = Number((deductionHours * hourlyRate).toFixed(2));
          break;

        case "fixed":
          deductionHours = 0;

          amount = Number(Number(item.deduction?.value || 0).toFixed(2));

          totalFixedAmount += amount;
          break;

        default:
          deductionHours = 0;
          amount = 0;
      }

      totalDeductionHours += deductionHours;

      totalAmount += amount;

      // =========================
      // BREAKDOWN DATA
      // =========================
      return {
        logId: item._id,

        violation: {
          type: item.violationType,
          occurrences: item.occurrenceCount,
          ruleId: item.sourceRuleId,
          executedAt: item.executedAt,
        },

        deduction: {
          unit,
          value,

          rate: hourlyRate,

          shiftHours: unit === "day" ? shiftHours : null,

          hours: Number(deductionHours.toFixed(2)),
        },

        period: {
          start: item.periodStart,
          end: item.periodEnd,
        },

        calculation: {
          formula:
            unit === "minutes"
              ? `(${value} ÷ 60) × hourlyRate`
              : unit === "hour"
                ? `${value} × hourlyRate`
                : unit === "day"
                  ? `${value} × shiftHours × hourlyRate`
                  : unit === "fixed"
                    ? `${value} (fixed)`
                    : `${value}`,

          amount,
        },
      };
    });

    totalDeductionHours = Number(totalDeductionHours.toFixed(2));

    totalFixedAmount = Number(totalFixedAmount.toFixed(2));

    totalAmount = Number(totalAmount.toFixed(2));

    // =========================
    // LABEL
    // =========================
    let label = "Violation Deductions";

    // =========================
    // PAYROLL LINE
    // =========================
    const linePayload = {
      payrollPeriodId: period._id,
      payrollEmployeeId: payroll._id,
      employeeId: employee._id,

      category: "deduction",
      type: "manual_adjustment",

      label,

      quantity: totalDeductionHours,

      rate: hourlyRate,
      unit: "hour",

      Originalamount: totalAmount,
      amount: totalAmount,

      sourceType: "penalty",

      isManual: false,
      isSystemGenerated: true,

      metadata: {
        breakdown,

        summary: {
          deductionHours: totalDeductionHours,
          fixedAmount: totalFixedAmount,
          totalAmount,
        },
      },

      status: "success",
    };

    const createdLine = await PayrollEmployeeLine.create(linePayload);

    return {
      success: true,

      result: {
        quantity: totalDeductionHours,
        rate: hourlyRate,
        amount: totalAmount,
        breakdown,
      },

      linePayload: createdLine,
    };
  } catch (err) {
    const failureLine = {
      payrollPeriodId: period._id,
      payrollEmployeeId: payroll._id,
      employeeId: employee._id,

      category: "info",
      type: "manual_adjustment",

      label: "deduction_failed",

      amount: 0,

      sourceType: "penalty",

      isSystemGenerated: true,

      status: "failed",
      errorMessage: err.message,
    };

    await PayrollEmployeeLine.create(failureLine);

    return {
      success: false,
      error: err.message,
      linePayload: failureLine,
    };
  }
};

function getShiftHours(employee) {
  const start = employee?.groupId?.fixedAttendance?.startTime;

  const end = employee?.groupId?.fixedAttendance?.endTime;

  if (!start || !end) return 8;

  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);

  return (eh * 60 + em - (sh * 60 + sm)) / 60;
}
