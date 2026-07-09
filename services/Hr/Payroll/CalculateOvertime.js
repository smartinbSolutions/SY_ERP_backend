const PayrollEmployeeLine = require("../../../models/Hr/Payrolls/employeePayrollLine.js");

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
        result: {
          totalHours: 0,
          amount: 0,
        },
        linePayload: null,
      };
    }

    const hourlyRate = Number(employee.salary.hourlyRate || 0);

    let totalHours = 0;
    let totalAmount = 0;

    const breakdown = overtime.map((item) => {
      const hours = Number(item.calculation?.hours || 0);

      const multiplier =
        item.calculation?.appliedRateMultiplier ??
        item.ruleSnapshot?.rateMultiplier ??
        1;

      const amount = Number((hours * hourlyRate * multiplier).toFixed(2));

      totalHours += hours;
      totalAmount += amount;

      return {
        overtimeId: item._id,

        period: {
          date: item.date || null,
          startTime: item.startTime || null,
          endTime: item.endTime || null,
        },

        calculation: {
          hours,
          hourlyRate,
          multiplier,
          formula: `${hours} × ${hourlyRate} × ${multiplier}`,
          amount,
        },

        rule: {
          name: item.ruleSnapshot?.name || null,
          type: item.ruleSnapshot?.type || null,
          sourceRuleId: item.ruleSnapshot?._id || null,
        },

        status: item.status || null,
        approvedAt: item.approvedAt || null,
        createdAt: item.createdAt || null,
      };
    });

    totalHours = Number(totalHours.toFixed(2));
    totalAmount = Number(totalAmount.toFixed(2));
    
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
