const PayrollEmployeeLine = require("../../../models/Hr/employeePayrollLine");

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

    const breakdown = deductions.map((item) => {
      const unit = item.deduction?.unit;
      const value = Number(item.deduction?.value || 0);

      let amount = 0;

      switch (unit) {
        case "hour":
          amount = value * hourlyRate;
          break;

        case "day":
          amount = value * shiftHours * hourlyRate;
          break;

        case "fixed":
          amount = Number(item.deduction?.amount || 0);
          break;

        default:
          amount = 0;
      }

      totalAmount += amount;

      return {
        logId: item._id,
        violationType: item.violationType,
        occurrenceCount: item.occurrenceCount,

        unit,
        value,

        amount,
      };
    });

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
