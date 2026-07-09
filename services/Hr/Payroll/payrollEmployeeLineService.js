const PayrollEmployeeLine = require("../../../models/Hr/Payrolls/employeePayrollLine");
const employeepayrollModel = require("../../../models/Hr/Payrolls/employeePayrollModel");

// ================= CREATE =================
exports.createPayrollEmployeeLine = async (data) => {
  const line = await PayrollEmployeeLine.create(data);

  await recalculatePayroll(line.payrollEmployeeId);

  return line;
};

// ================= BULK CREATE (مهم للـ payroll) =================
exports.createManyPayrollEmployeeLines = async (lines = []) => {
  if (!lines.length) return [];
  return await PayrollEmployeeLine.insertMany(lines);
};

// ================= GET ALL =================
exports.getPayrollEmployeeLines = async ({
  payrollPeriodId,
  payrollEmployeeId,
  employeeId,
  category,
  type,
}) => {
  const query = {};

  if (payrollPeriodId) query.payrollPeriodId = payrollPeriodId;
  if (payrollEmployeeId) query.payrollEmployeeId = payrollEmployeeId;
  if (employeeId) query.employeeId = employeeId;
  if (category) query.category = category;
  if (type) query.type = type;

  return await PayrollEmployeeLine.find(query).sort({ createdAt: -1 }).lean();
};

// ================= GET BY ID =================
exports.getPayrollEmployeeLineById = async (id) => {
  return await PayrollEmployeeLine.findById(id);
};

// ================= UPDATE =================
exports.updatePayrollEmployeeLine = async (id, data) => {
  const updatedLine = await PayrollEmployeeLine.findByIdAndUpdate(id, data, {
    new: true,
  });

  await recalculatePayroll(updatedLine.payrollEmployeeId);

  return updatedLine;
};

// ================= DELETE =================
exports.deletePayrollEmployeeLine = async (id) => {
  console.log("deletedLine id:", id);

  // 1. جيب البيانات أولاً
  const line = await PayrollEmployeeLine.findById(id);

  if (!line) {
    throw new Error("Payroll line not found");
  }

  console.log("line found:", line);

  // 2. احذف
  const deleted = await PayrollEmployeeLine.deleteOne({ _id: id });

  console.log("deleted result:", deleted);

  // 3. استخدم البيانات القديمة لإعادة الحساب
  await recalculatePayroll(line.payrollEmployeeId);

  return deleted;
};

// ================= GET BY PAYROLL EMPLOYEE =================
exports.getByPayrollEmployee = async (payrollEmployeeId) => {
  return await PayrollEmployeeLine.find({ payrollEmployeeId }).lean();
};

// ================= SUMMARY =================
exports.getPayrollLinesSummary = async (payrollPeriodId) => {
  const lines = await PayrollEmployeeLine.find({ payrollPeriodId }).lean();

  return lines.reduce(
    (acc, line) => {
      acc.total += line.amount || 0;

      if (line.category === "earning") acc.earnings += line.amount || 0;
      if (line.category === "deduction") acc.deductions += line.amount || 0;

      return acc;
    },
    { total: 0, earnings: 0, deductions: 0 },
  );
};

async function recalculatePayroll(payrollEmployeeId) {
  const payroll = await employeepayrollModel.findById(payrollEmployeeId);
  if (!payroll) throw new Error("Payroll not found");

  const lines = await PayrollEmployeeLine.find({
    payrollEmployeeId,
    status: "success",
  }).lean();

  let earnings = 0;
  let deductions = 0;
  let bonuses = 0;
  let overtime = 0;
  console.log(lines);

  for (const line of lines) {
    if (!line.affectsNetSalary) continue;

    const amount = Number(line.amount || 0);

    if (line.category === "earning") earnings += amount;
    if (line.category === "deduction") deductions += amount;

    // if (line.type === "bonus") bonuses += amount;
    // if (line.type === "overtime") overtime += amount;
  }

  const net =
    Number(payroll.salaryBase || 0) +
    earnings +
    overtime +
    bonuses -
    deductions;
  console.log("net", net);

  payroll.netSalary = net;

  await payroll.save();

  return payroll;
}
