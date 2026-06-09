const EmployeePayroll = require("../../../models/Hr/employeepayrollModel.js");
const { CalculateAdvances } = require("./CalculateAdvances.js");
const { calculateAttendance } = require("./CalculateAttendence.js");
const { CalculateLeaves } = require("./CalculateLeaves.js");
const { CalculateOvertime } = require("./CalculateOvertime.js");

exports.processEmployeePayroll = async (employee, context) => {
  let payroll;

  // ==============================
  // Employee Data
  // ==============================
  const employeeId = employee._id.toString();

  const employeeAttendance = context.attendanceMap[employeeId] || [];
  const employeeLeaves = context.leaveMap[employeeId] || [];
  const employeeOvertime = context.overtimeMap[employeeId] || [];
  const employeeAdvances = context.advanceMap[employeeId] || [];

  // ==============================
  // Debug Logs
  // ==============================
  console.log("\n==============================");
  console.log("Employee:", employeeId);

  console.log("Attendance:");
  console.dir(employeeAttendance, { depth: null });

  console.log("Leaves:");
  console.dir(employeeLeaves, { depth: null });

  console.log("Overtime:");
  console.dir(employeeOvertime, { depth: null });

  console.log("Advances:");
  console.dir(employeeAdvances, { depth: null });

  // ==============================
  // Create Employee Payroll
  // ==============================
  try {
    payroll = await EmployeePayroll.create({
      employeeId: employee._id,
      payrollPeriodId: context.period._id,
      payrollGroupId: employee.payrollGroupId,
      salaryBase: employee.salary || 0,
      netSalary: 0,
      status: "processing",
    });
  } catch (err) {
    console.error("❌ FULL ERROR:", err);
    throw err;
  }

  // ==============================
  // Execute Calculators
  // ==============================
  const attendance = await calculateAttendance({
    employee,
    attendance: employeeAttendance,
    period: context.period,
    payroll,
  });

  const leaves = await CalculateLeaves({
    employee,
    leaves: employeeLeaves,
    period: context.period,
    payroll,
  });

  const overtime = await CalculateOvertime({
    employee,
    overtime: employeeOvertime,
    period: context.period,
    payroll,
  });

  const advances = await CalculateAdvances({
    employee,
    advances: employeeAdvances,
    period: context.period,
    payroll,
  });

  // ==============================
  // Final Salary
  // ==============================
  const netSalary =
    (employee.salary || 0) +
    (overtime?.amount || 0) -
    (leaves?.amount || 0) -
    (advances?.amount || 0);

  // await EmployeePayroll.findByIdAndUpdate(payroll._id, {
  //   netSalary,
  //   status: "calculated",
  // });

  return {
    payrollId: payroll._id,
    netSalary,
    status: "success",
  };
};
