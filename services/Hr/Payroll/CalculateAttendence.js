const PayrollEmployeeLine = require("../../../models/Hr/employeePayrollLine.js");

exports.calculateAttendance = async ({
  employee,
  attendance,
  period,
  payroll,
}) => {
  try {
    // ================================
    // 1. NORMALIZATION
    // ================================

    const sessions = buildAttendanceSessions(attendance || []);

    // ================================
    // 2. BUSINESS LOGIC
    // ================================
    const totalHours = sessions.reduce((sum, s) => {
      return sum + (s.duration || 0);
    }, 0);

    const expectedHours = sessions.length * 8;

    const missingHours = Math.max(expectedHours - totalHours, 0);

    const hourlyRate = (employee.salary || 0) / 160;

    const deductionAmount = missingHours * hourlyRate;

    // ================================
    // 3. RESULT OBJECT
    // ================================
    const result = {
      totalHours,
      expectedHours,
      missingHours,
      hourlyRate,
      deductionAmount,
    };

    // ================================
    // 4. LINE PAYLOAD (AFTER CALC ONLY)
    // ================================
    const linePayload = {
      payrollPeriodId: period._id,
      payrollEmployeeId: payroll._id,
      employeeId: employee._id,

      category: "deduction",
      type: "absence_deduction",
      label: "attendance",

      quantity: missingHours,
      unit: "hour",
      rate: hourlyRate,

      amount: deductionAmount,

      sourceType: "attendance",
      isSystemGenerated: true,

      status: "success",
    };

    // ================================
    // 5. CREATE LINE (ONCE ONLY HERE)
    // ================================
    await PayrollEmployeeLine.create(linePayload);

    return {
      success: true,
      result,
      linePayload,
      error: null,
    };
  } catch (err) {
    // ================================
    // 6. FAILURE LINE (ALSO SAVED)
    // ================================
    const failureLine = {
      payrollPeriodId: period._id,
      payrollEmployeeId: payroll._id,
      employeeId: employee._id,

      category: "info",
      type: "manual_adjustment",
      label: "attendance_failed",

      amount: 0,

      status: "failed",
      errorMessage: err.message,

      isSystemGenerated: true,
    };

    await PayrollEmployeeLine.create(failureLine);

    return {
      success: false,
      result: null,
      linePayload: failureLine,
      error: err.message,
    };
  }
};

function buildAttendanceSessions(attendance) {
  const sessions = [];
  let lastCheckIn = null;

  for (const record of attendance) {
    if (record.type === "Check-in") {
      lastCheckIn = record;
    }

    if (record.type === "Check-out" && lastCheckIn) {
      const start = new Date(`1970-01-01T${lastCheckIn.Time}Z`);
      const end = new Date(`1970-01-01T${record.Time}Z`);

      const duration = (end - start) / (1000 * 60 * 60);

      sessions.push({
        start: lastCheckIn.Time,
        end: record.Time,
        duration: Math.max(duration, 0),
      });

      lastCheckIn = null;
    }
  }

  return sessions;
}
