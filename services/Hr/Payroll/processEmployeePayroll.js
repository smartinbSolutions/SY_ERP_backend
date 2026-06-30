const EmployeePayroll = require("../../../models/Hr/Payrolls/employeePayrollModel.js");
const EmployeePayrollState = require("../../../models/Hr/Payrolls/EmployeePayrollStateSchema.js");
const { CalculateAdvances } = require("./CalculateAdvances.js");
const { calculateAttendance } = require("./CalculateAttendence.js");
const { CalculateDeductions } = require("./CalculateDeductions.js");
const { CalculateLeaves } = require("./CalculateLeaves.js");
const { CalculateOvertime } = require("./CalculateOvertime.js");

exports.processEmployeePayroll = async (employee, context, stateId) => {
  let payroll;

  try {
    payroll = await EmployeePayroll.findOneAndUpdate(
      {
        employeeId: employee._id,
        payrollPeriodId: context.period._id,
      },
      {
        $setOnInsert: {
          employeeId: employee._id,
          payrollPeriodId: context.period._id,
          payrollGroupId: employee.payrollGroupId,
          salaryBase: employee.salary.amount || 0,
          netSalary: 0,
          status: "processing",
        },
      },
      {
        new: true,
        upsert: true,
      },
    );
    // await EmployeePayrollState.findByIdAndUpdate(stateId, {
    //   step: "init",
    //   status: "processing",
    //   startedAt: new Date(),
    // });
    await EmployeePayrollState.findByIdAndUpdate(stateId, {
      status: "processing",
      step: "attendance",
      startedAt: new Date(),
    });

    const employeeId = employee._id.toString();

    const employeeAttendance = context.attendanceMap[employeeId] || [];
    const employeeLeaves = context.leaveMap[employeeId] || [];
    const employeeOvertime = context.overtimeMap[employeeId] || [];
    const employeeAdvances = context.advanceMap[employeeId] || [];
    const employeeDeductions = context.deductionMap[employeeId] || [];

    const attendance = await calculateAttendance({
      employee,
      attendance: employeeAttendance,
      period: context.period,
      payroll,
    });

    await EmployeePayrollState.findByIdAndUpdate(stateId, {
      step: "leaves",
    });

    const leaves = await CalculateLeaves({
      employee,
      leaves: employeeLeaves,
      period: context.period,
      payroll,
    });

    await EmployeePayrollState.findByIdAndUpdate(stateId, {
      step: "overtime",
    });

    const overtime = await CalculateOvertime({
      employee,
      overtime: employeeOvertime,
      period: context.period,
      payroll,
    });

    await EmployeePayrollState.findByIdAndUpdate(stateId, {
      step: "advances",
    });

    const advances = await CalculateAdvances({
      employee,
      advances: employeeAdvances,
      period: context.period,
      payroll,
    });

    await EmployeePayrollState.findByIdAndUpdate(stateId, {
      step: "deductions",
    });

    const deductions = await CalculateDeductions({
      employee,
      deductions: employeeDeductions,
      period: context.period,
      payroll,
    });

    const netSalary =
      (employee.salary.amount || 0) +
      (overtime?.result?.amount || 0) -
      (leaves?.result?.amount || 0) -
      (advances?.result?.amount || 0) -
      (deductions?.result?.amount || 0);

    await EmployeePayroll.findByIdAndUpdate(payroll._id, {
      netSalary,
      status: "calculated",
    });

    await EmployeePayrollState.findByIdAndUpdate(stateId, {
      step: "done",
    });

    return {
      payrollId: payroll._id,
      netSalary,
      status: "success",
    };
  } catch (err) {
    await EmployeePayrollState.findByIdAndUpdate(stateId, {
      status: "failed",
      step: "error",
      errorMessage: err.message,
    });

    return {
      status: "failed",
      error: err.message,
    };
  }
};
