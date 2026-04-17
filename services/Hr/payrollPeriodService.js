const PayrollPeriod = require("../../models/Hr/payrollPeriodModel");
const Staff = require("../../models/Hr/staffModel");
const PayrollGroup = require("../../models/Hr/payrollGroupModel");
const EmployeePayroll = require("../../models/Hr/employeepayrollModel");
const groupsModel = require("../../models/Hr/groupsModel");
const staffModel = require("../../models/Hr/staffModel");
const buildPayrollContext = require("./Payroll/buildPayrollContext");
const { processEmployeePayroll } = require("./Payroll/processEmployeePayroll");
// ================= CREATE =================
exports.createPayrollPeriod = async (data) => {
  return await PayrollPeriod.create(data);
};

// ================= GET ALL =================
exports.getPayrollPeriods = async ({ companyId }) => {
  return await PayrollPeriod.find({ companyId })
    .populate("payrollGroupId")
    .sort({ createdAt: -1 });
};

// ================= GET ONE =================
exports.getPayrollPeriodById = async (id) => {
  return await PayrollPeriod.findById(id);
};

// ================= UPDATE =================
exports.updatePayrollPeriod = async (id, data) => {
  return await PayrollPeriod.findByIdAndUpdate(id, data, { new: true });
};

// ================= DELETE =================
exports.deletePayrollPeriod = async (id) => {
  return await PayrollPeriod.deleteOne({ _id: id });
};

// ================= GENERATE PAYROLL  =================
exports.generatePayrollForPeriod = async (periodId) => {
  console.log("🚀 START generatePayrollForPeriod");
  console.log("Period ID:", periodId);

  // 1. get period
  const period = await PayrollPeriod.findById(periodId);
  if (!period) {
    console.log("❌ Period not found");
    throw new Error("Payroll period not found");
  }

  console.log("✅ Period found:", period._id);

  // 2. get payroll group
  const payrollGroup = await PayrollGroup.findById(period.payrollGroupId);
  if (!payrollGroup) {
    console.log("❌ Payroll group not found");
    throw new Error("Payroll group not found");
  }

  console.log("✅ Payroll group found:", payrollGroup._id);

  // 3. get staff directly by payrollGroupId (updated design)
  console.log("sss", period.payrollGroupId);

  const staff = await staffModel.find({
    payrollGroupId: period.payrollGroupId,
  });

  console.log("👥 Staff found:", staff.length);

  if (!staff.length) {
    console.log("❌ No staff found for this payroll group");
    throw new Error("No staff found for this payroll group");
  }

  // 4. prepare bulk payroll inserts (performance optimized)
  const payrollDocs = staff.map((emp) => {
    const salaryBase = emp.salary || 0;

    return {
      employeeId: emp._id,
      payrollPeriodId: period._id,
      payrollGroupId: payrollGroup._id,
      policiesSnapshot: payrollGroup.policiesSnapshot,
      salaryBase,
      netSalary: salaryBase,
    };
  });

  // 5. insert all payrolls in one operation
  const payrolls = await EmployeePayroll.insertMany(payrollDocs);

  console.log("✅ Payrolls created:", payrolls.length);

  // 6. update period status
  period.status = "processing";
  await period.save();

  console.log("📌 Period status updated to processing");

  console.log("🎉 DONE generatePayrollForPeriod");

  return payrolls;
};

exports.getStaffByPayrollPeriod = async (periodId) => {
  const period = await PayrollPeriod.findById(periodId);

  if (!period) {
    throw new Error("Payroll period not found");
  }

  const staff = await staffModel
    .find({
      payrollGroupId: period.payrollGroupId,
      companyId: period.companyId,
      isActive: true,
    })
    .populate("department", "name")
    .populate("position", "name");

  return {
    period,
    staff,
  };
};

exports.generateSalaryPayroll = async (periodId) => {
  const context = await buildPayrollContext(periodId);

// ////////////////


  const results = [];
  const failed = [];

  for (const emp of context.employees) {
    try {
      const res = await processEmployeePayroll(emp, context);

      if (res.status === "failed") {
        failed.push(res);
      } else {
        results.push(res);
      }
    } catch (err) {
      failed.push({ empId: emp._id, error: err.message });
    }
  }

  return {
    context,
    success: results.length,
    failed: failed.length,
  };
};
