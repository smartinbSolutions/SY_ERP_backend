import EmployeePayroll from "../../../models/Hr/employeepayrollModel.js";
import { CalculateAdvances } from "./CalculateAdvances.js";
import { calculateAttendance } from "./CalculateAttendence.js";
import { CalculateLeaves } from "./CalculateLeaves.js";
import { CalculateOvertime } from "./calculateOvertime.js";

export const processEmployeePayroll = async (employee, context) => {
  let payroll ;
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
  }

  const employeeId = employee._id.toString();

  const employeeAttendance = context.attendanceMap[employeeId] || [];
  const employeeLeaves = context.leaveMap[employeeId] || [];
  const employeeOvertime = context.overtimeMap[employeeId] || [];
  const employeeAdvances = context.advanceMap[employeeId] || [];

  // ================================
  // EXECUTION ONLY (NO SIDE EFFECTS HERE)
  // ================================
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

  // ================================
  // FINAL AGGREGATION ONLY
  // ================================
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
