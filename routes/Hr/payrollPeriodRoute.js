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
  .get(authService.protect, getPayrollPeriods)
  .post(authService.protect, createPayrollPeriod);

payrollPeriodRoute
  .route("/:id")
  .get(authService.protect, getPayrollPeriodById)
  .patch(authService.protect, updatePayrollPeriod)
  .delete(authService.protect, deletePayrollPeriod);

payrollPeriodRoute
  .route("/generate-payroll/:id")
  .post(authService.protect, generatePayroll);

  payrollPeriodRoute
  .route("/:id/staff")
  .get(authService.protect, getPayrollPeriodStaff);


payrollPeriodRoute
  .route("/:id/generate-salary")
  .post(authService.protect, generateSalaryPayroll);

module.exports = payrollPeriodRoute;
