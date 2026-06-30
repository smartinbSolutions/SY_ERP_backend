const EmployeePayroll = require("../../../models/Hr/Payrolls/employeePayrollModel");

const getAllEmployeePayrollService = async ({
  employeeId,
  payrollPeriodId,
  status,
  page = 1,
  limit = 10,
}) => {
  const query = {};

  if (employeeId) {
    query.employeeId = employeeId;
  }

  if (payrollPeriodId) {
    query.payrollPeriodId = payrollPeriodId;
  }

  if (status) {
    query.status = status;
  }

  const skip = (page - 1) * limit;

  const total = await EmployeePayroll.countDocuments(query);

  const data = await EmployeePayroll.find(query)
    .populate("employeeId", "fullName email employeeNumber")
    .populate("payrollPeriodId", "name startDate endDate")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    results: data.length,
    data,
  };
};

module.exports = {
  getAllEmployeePayrollService,
};
