const expressAsyncHandler = require("express-async-handler");
const { getAllEmployeePayrollService } = require("../../../services/Hr/Payroll/employeePayrollService");

exports.getEmployeePayrolls = expressAsyncHandler(async (req, res) => {
  const result = await getAllEmployeePayrollService({
    employeeId: req.query.employeeId,
    payrollPeriodId: req.query.payrollPeriodId,
    status: req.query.status,
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 10,
  });

  res.status(200).json({
    status: "success",
    ...result,
  });
});
