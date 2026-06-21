const PayrollGroup = require("../../models/Hr/payrollGroupModel");
const mongoose = require("mongoose");
const ApiError = require("../../utils/apiError");

// models for validation
const LeavePolicy = require("../../models/Hr/Leaves/leavesPolicyModel");
const OvertimePolicy = require("../../models/Hr/Overtime/overtimePolicyModel");
const AdvancePolicy = require("../../models/Hr/Advance/advancePolicyModel");

// ================= VALIDATE IDS =================
const validateObjectId = (id, name) => {
  if (!id) return;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(`Invalid ${name} ID format`, 400);
  }
};

// ================= CREATE =================
exports.createPayrollGroup = async (data) => {
  const { companyId, policiesSnapshot = {} } = data;

  if (!companyId) {
    throw new ApiError("companyId is required", 400);
  }

  // ================= VALIDATE IDS FORMAT =================
  validateObjectId(policiesSnapshot.leavePolicy, "leavePolicy");
  validateObjectId(policiesSnapshot.overtimePolicy, "overtimePolicy");
  validateObjectId(policiesSnapshot.advancePolicy, "advancePolicy");

  // ================= VALIDATE EXISTENCE (WITH COMPANY SCOPE) =================
  if (policiesSnapshot.leavePolicy) {
    const exists = await LeavePolicy.findOne({
      _id: policiesSnapshot.leavePolicy,
      companyId,
    });
    if (!exists) throw new ApiError("Leave policy not found", 404);
  }

  if (policiesSnapshot.overtimePolicy) {
    const exists = await OvertimePolicy.findOne({
      _id: policiesSnapshot.overtimePolicy,
      companyId,
    });
    if (!exists) throw new ApiError("Overtime policy not found", 404);
  }

  if (policiesSnapshot.advancePolicy) {
    const exists = await AdvancePolicy.findOne({
      _id: policiesSnapshot.advancePolicy,
      companyId,
    });
    if (!exists) throw new ApiError("Advance policy not found", 404);
  }

  // ================= CREATE =================
  return await PayrollGroup.create(data);
};

// ================= GET ALL =================
exports.getPayrollGroups = async (companyId) => {
  return await PayrollGroup.find({ companyId }).sort({ createdAt: -1 });
};

// ================= GET ONE =================
exports.getPayrollGroupById = async (companyId, id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError("Invalid PayrollGroup ID format", 400);
  }

  const group = await PayrollGroup.findOne({
    _id: id,
    companyId,
  });

  if (!group) {
    throw new ApiError(`Payroll group not found`, 404);
  }

  return group;
};

// ================= UPDATE =================
exports.updatePayrollGroup = async (companyId, id, data) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError("Invalid PayrollGroup ID format", 400);
  }

  const group = await PayrollGroup.findOneAndUpdate(
    { _id: id, companyId },
    data,
    { new: true, runValidators: true },
  );

  if (!group) {
    throw new ApiError(`Payroll group not found`, 404);
  }

  return group;
};

// ================= DELETE =================
exports.deletePayrollGroup = async (companyId, id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError("Invalid PayrollGroup ID format", 400);
  }

  const group = await PayrollGroup.findOneAndDelete({
    _id: id,
    companyId,
  });

  if (!group) {
    throw new ApiError(`Payroll group not found`, 404);
  }

  return group;
};
