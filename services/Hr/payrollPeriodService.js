const PayrollPeriod = require("../../models/Hr/payrollPeriodModel");

//  CREATE
exports.createPayrollPeriod = async (data) => {
  return await PayrollPeriod.create(data);
};

//  GET ALL
exports.getPayrollPeriods = async ({ companyId }) => {
  return await PayrollPeriod.find({ companyId }).sort({ createdAt: -1 });
};

//  GET ONE
exports.getPayrollPeriodById = async (id) => {
  return await PayrollPeriod.findById(id);
};

//  UPDATE
exports.updatePayrollPeriod = async (id, data) => {
  return await PayrollPeriod.findByIdAndUpdate(id, data, { new: true });
};

//  DELETE
exports.deletePayrollPeriod = async (id) => {
  return await PayrollPeriod.deleteOne({ _id: id });
};
