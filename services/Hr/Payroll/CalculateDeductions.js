const PayrollEmployeeLine = require("../../../models/Hr/Payrolls/employeePayrollLine");

exports.CalculateDeductions = async ({
  employee,
  deductions = [],
  period,
  payroll,
}) => {
  // console.log("ddddddddddddd", deductions);

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

    const breakdown = deductions.map((item) => {
      const unit = item.deduction?.unit;
      const value = Number(item.deduction?.value || 0);
      console.log("item", item);

      let amount = 0;

      switch (unit) {
        
        case "minutes":
          amount = Number(((value / 60) * hourlyRate).toFixed(2));
          break;
        case "hour":
          amount = Number((value * hourlyRate).toFixed(2));
          break;

        case "day":
          amount = Number((value * shiftHours * hourlyRate).toFixed(2));
          break;

        case "fixed":
          amount = Number(Number(item.deduction?.value || 0).toFixed(2));
          break;

        default:
          amount = 0;
      }

      totalAmount += amount;
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
          rate: unit === "hour" ? hourlyRate : null,
          shiftHours: unit === "day" ? shiftHours : null,
        },

        period: {
          start: item.periodStart,
          end: item.periodEnd,
        },

        calculation: {
          formula:
            unit === "hour"
              ? `${value} × hourlyRate`
              : unit === "day"
                ? `${value} × shiftHours × hourlyRate`
                : `${value} (fixed)`,

          amount,
        },
      };
    });

    totalAmount = Number(totalAmount.toFixed(2));

    const linePayload = {
      payrollPeriodId: period._id,
      payrollEmployeeId: payroll._id,
      employeeId: employee._id,

      category: "deduction",
      type: "manual_adjustment",

      label: "Violation Deductions",

      rate: hourlyRate,

      Originalamount: totalAmount,
      amount: totalAmount,

      sourceType: "penalty",

      isManual: false,
      isSystemGenerated: true,

      metadata: {
        breakdown,
      },

      status: "success",
    };

    const createdLine = await PayrollEmployeeLine.create(linePayload);

    return {
      success: true,

      result: {
        quantity: deductions.length,
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
