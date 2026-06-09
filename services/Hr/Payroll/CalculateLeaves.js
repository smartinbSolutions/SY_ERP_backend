const PayrollEmployeeLine = require("../../../models/Hr/employeePayrollLine.js");

/**
 * Filter leaves inside payroll period
 */
function filterLeavesByPeriod(leaves, period) {
  const start = new Date(period.startDate);
  const end = new Date(period.endDate);

  return (leaves || []).filter((leave) => {
    const leaveStart = new Date(leave.startDate);
    const leaveEnd = new Date(leave.endDate);

    return leaveEnd >= start && leaveStart <= end;
  });
}

exports.CalculateLeaves = async ({ employee, leaves, period, payroll }) => {
  try {
    console.log(`\n========== LEAVES START (${employee._id}) ==========\n`);

    const filteredLeaves = filterLeavesByPeriod(leaves, period);

    console.log(
      `Found ${filteredLeaves.length} leave logs inside payroll period`,
    );

    const createdLines = [];
    let totalDeduction = 0;

    const dailyRate = (employee.salary || 0) / 30;

    for (const leave of filteredLeaves) {
      const totalDays = leave.totalDays || 0;

      // 👇 أهم تغيير هنا: نعتمد على نسبة الدفع
      const payPercentage =
        leave.appliedPayPercentage ?? leave.payPercentage ?? 0;

      const leaveType = leave.leaveType;

      console.log(`Checking leave type=${leaveType} | pay=${payPercentage}%`);

      const unpaidRatio = (100 - payPercentage) / 100;
      const amount = totalDays * dailyRate * unpaidRatio;

      if (amount <= 0) {
        console.log("No deduction (fully paid leave)");
        continue;
      }

      console.log(
        `Creating leave line -> days=${totalDays}, rate=${dailyRate}, amount=${amount}`,
      );

      const linePayload = {
        payrollPeriodId: period._id,
        payrollEmployeeId: payroll._id,
        employeeId: employee._id,

        category: "deduction",
        type: "leave_deduction",
        label: `leave_${leaveType}`,

        quantity: totalDays,
        unit: "day",
        rate: dailyRate,

        amount,

        sourceType: "leave_request",
        sourceId: leave._id,

        effectiveDate: leave.startDate,

        isSystemGenerated: true,
        status: "success",
      };

      const createdLine = await PayrollEmployeeLine.create(linePayload);

      createdLines.push(createdLine);

      totalDeduction += amount;

      console.log("✓ Line created successfully");
    }

    console.log(
      `Finished leaves processing. Total deduction = ${totalDeduction}`,
    );

    return {
      success: true,
      amount: totalDeduction,
      linesCount: createdLines.length,
      linePayload: createdLines,
    };
  } catch (err) {
    console.error("LEAVES ERROR:", err);

    const failureLine = await PayrollEmployeeLine.create({
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
    });

    return {
      success: false,
      amount: 0,
      linesCount: 0,
      linePayload: failureLine,
      error: err.message,
    };
  }
};
