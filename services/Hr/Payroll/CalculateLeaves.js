const PayrollEmployeeLine = require("../../../models/Hr/Payrolls/employeePayrollLine.js");

exports.CalculateLeaves = async ({ employee, leaves, period, payroll }) => {
  try {
    // console.log("===== LEAVE ENGINE START =====");
    // console.log(leaves);

    // console.log("Employee ID:", employee?._id);
    // console.log("Hourly Rate:", employee?.hourlyRate);

    const createdLines = [];
    let totalDeduction = 0;

    const group = employee.groupId || {};

    const {
      attendanceType,
      fixedAttendance = {},
      flexibleAttendance = {},
    } = group;

    // shift hours (same logic as attendance engine)
    const shiftHours =
      attendanceType === "fixed"
        ? calcShiftHours(fixedAttendance?.startTime, fixedAttendance?.endTime)
        : flexibleAttendance?.requiredHoursPerDay || 8;

    // IMPORTANT: use hourlyRate (not dailyRate)
    const hourlyRate = employee.salary.hourlyRate;

    // console.log("Calculated shiftHours:", shiftHours);
    // console.log("Using hourlyRate:", hourlyRate);

    for (const leave of leaves) {
      // console.log("\n--- Leave ---", leave._id);

      const totalDays = leave.totalDays || 0;

      const payPercentage =
        leave.appliedPayPercentage ?? leave.payPercentage ?? 0;

      // console.log("totalDays:", totalDays);
      // console.log("payPercentage:", payPercentage);

      // 🔥 NEW CORE LOGIC (hour-based)
      const leaveHours = totalDays * shiftHours;

      const unpaidHours = Number(
        (leaveHours * (1 - payPercentage / 100)).toFixed(2),
      );
      // console.log("leaveHours:", leaveHours);
      // console.log("unpaidHours:", unpaidHours);

      if (unpaidHours <= 0) {
        console.log("SKIPPED: fully paid leave");
        continue;
      }

      const amount = Number((unpaidHours * hourlyRate).toFixed(2));
      // console.log("final amount:", amount);

      const linePayload = {
        payrollPeriodId: period._id,
        payrollEmployeeId: payroll._id, // FIXED (important)
        employeeId: employee._id,

        category: "deduction",
        type: "leave_deduction",
        label: `leave_${leave.leaveType}`,

        quantity: unpaidHours,
        unit: "hour",
        rate: hourlyRate,

        amount,
        Originalamount: amount,

        sourceType: "leave_request",
        sourceId: leave._id,

        effectiveDate: leave.startDate,

        isSystemGenerated: true,
        status: "success",

        metadata: {
          logId: leave._id || null,
          leaveType: leave.leaveType,

          payPercentage: leave.payPercentage,
          appliedPayPercentage: leave.appliedPayPercentage,

          effectivePayPercentage:
            leave.appliedPayPercentage ?? leave.payPercentage,

          totalDays: leave.totalDays,

          period: {
            startDate: leave.startDate,
            endDate: leave.endDate,
          },

          compensation: {
            isFullyPaid:
              (leave.appliedPayPercentage ?? leave.payPercentage) === 100,
            unpaidRatio:
              1 - (leave.appliedPayPercentage ?? leave.payPercentage) / 100,
          },
        },
      };

      const createdLine = await PayrollEmployeeLine.create(linePayload);

      createdLines.push(createdLine);
      totalDeduction += amount;
    }

    return {
      success: true,

      result: {
        quantity: createdLines.reduce(
          (sum, line) => sum + (line.quantity || 0),
          0,
        ),

        rate: hourlyRate,
        amount: totalDeduction,

        breakdown: createdLines.map((line) => ({
          leaveId: line.sourceId,
          hours: line.quantity,
          rate: line.rate,
          amount: line.amount,
        })),
      },

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

/* helper */
function calcShiftHours(start, end) {
  if (!start || !end) return 8;

  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);

  return (eh * 60 + em - (sh * 60 + sm)) / 60;
}
