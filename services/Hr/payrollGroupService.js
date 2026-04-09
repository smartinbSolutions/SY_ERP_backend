const PayrollGroup = require("../../models/Hr/payrollGroupModel");

//  CREATE
exports.createPayrollGroup = async (data) => {
  return await PayrollGroup.create(data);
};

//  GET ALL
exports.getPayrollGroups = async (companyId) => {
  return await PayrollGroup.find({ companyId }).sort({ createdAt: -1 });
};

//  GET ONE
exports.getPayrollGroupById = async (id) => {
  return await PayrollGroup.findById(id);
};

//  UPDATE
exports.updatePayrollGroup = async (id, data) => {
  return await PayrollGroup.findByIdAndUpdate(id, data, { new: true });
};

//  DELETE
exports.deletePayrollGroup = async (id) => {
  return await PayrollGroup.deleteOne({ _id: id });
};
