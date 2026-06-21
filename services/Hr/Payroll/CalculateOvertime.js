const PayrollEmployeeLine = require("../../../models/Hr/employeePayrollLine.js");

exports.CalculateOvertime = async ({
  employee,
  overtime = [],
  period,
  payroll,
}) => {
  try {
    if (!overtime.length) {
      return {
        success: true,
        result: { totalHours: 0, amount: 0 },
        linePayload: null,
      };
    }

    const hourlyRate = employee.salary.hourlyRate || 0;

    let totalHours = 0;
    let totalAmount = 0;

    const breakdown = overtime.map((item) => {
      const hours = item.calculation?.hours || 0;

      const multiplier =
        item.calculation?.appliedRateMultiplier ||
        item.ruleSnapshot?.rateMultiplier ||
        1;

      const pay = hours * hourlyRate * multiplier;

      totalHours += hours;
      totalAmount += pay;

      return {
        overtimeId: item._id,
        hours,
        hourlyRate,
        multiplier,
        amount: pay,
      };
    });

    const linePayload = {
      payrollPeriodId: period._id,
      payrollEmployeeId: payroll._id,
      employeeId: employee._id,

      category: "earning",
      type: "overtime",
      label: "Overtime",

      quantity: totalHours,
      unit: "hour",
      rate: hourlyRate,

      Originalamount: totalAmount,
      amount: totalAmount,

      sourceType: "overtime_request",

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
    quantity: totalHours,
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
      label: "overtime_failed",

      amount: 0,
      sourceType: "manual",

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
