const express = require("express");
const authService = require("../../services/authService");

const {
  createPayrollPeriod,
  deletePayrollPeriod,
  getPayrollPeriodById,
  getPayrollPeriods,
  updatePayrollPeriod,
  generatePayroll,
  getPayrollPeriodStaff,
  generateSalaryPayroll
} = require("../../controllers/Hr/payrollPeriod.controller");

const payrollPeriodRoute = express.Router();

payrollPeriodRoute
  .route("/")
  .get(authService.protect, authService.allowedTo("payroll.read"), getPayrollPeriods)
  .post(authService.protect, authService.allowedTo("payroll.create"), createPayrollPeriod);

payrollPeriodRoute
  .route("/:id")
  .get(authService.protect, authService.allowedTo("payroll.read"), getPayrollPeriodById)
  .patch(authService.protect, authService.allowedTo("payroll.update"), updatePayrollPeriod)
  .delete(authService.protect, authService.allowedTo("payroll.delete"), deletePayrollPeriod);

payrollPeriodRoute
  .route("/generate-payroll/:id")
  .post(authService.protect, authService.allowedTo("payroll.create"), generatePayroll);

  payrollPeriodRoute
  .route("/:id/staff")
  .get(authService.protect, authService.allowedTo("payroll.read"), getPayrollPeriodStaff);


payrollPeriodRoute
  .route("/:id/generate-salary")
  .post(authService.protect, authService.allowedTo("payroll.create"), generateSalaryPayroll);

module.exports = payrollPeriodRoute;
