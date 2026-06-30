const express = require("express");
const authService = require("../../../services/authService");

const {
  createPayrollPeriod,
  deletePayrollPeriod,
  getPayrollPeriodById,
  getPayrollPeriods,
  updatePayrollPeriod,
  generatePayroll,
  getPayrollPeriodStaff,
  generateSalaryPayroll,
  getPayrollReview,
  approvePayrollPeriod,
  getSuggestedPayrollPeriod,
} = require("../../../controllers/Hr/Payrolls/payrollPeriod.controller");

const payrollPeriodRoute = express.Router();

payrollPeriodRoute
  .route("/")
  .get(
    authService.protect,
    authService.allowedTo("payroll.read"),
    getPayrollPeriods,
  )
  .post(
    authService.protect,
    authService.allowedTo("payroll.create"),
    createPayrollPeriod,
  );

payrollPeriodRoute
  .route("/:id")
  .get(
    authService.protect,
    authService.allowedTo("payroll.read"),
    getPayrollPeriodById,
  )
  .patch(
    authService.protect,
    authService.allowedTo("payroll.update"),
    updatePayrollPeriod,
  )
  .delete(
    authService.protect,
    authService.allowedTo("payroll.delete"),
    deletePayrollPeriod,
  );

payrollPeriodRoute.route("/suggested/:groupId").get(getSuggestedPayrollPeriod);

payrollPeriodRoute
  .route("/:id/staff")
  .get(
    authService.protect,
    authService.allowedTo("payroll.read"),
    getPayrollPeriodStaff,
  );

payrollPeriodRoute
  .route("/:id/generate-salary")
  .post(
    authService.protect,
    authService.allowedTo("payroll.create"),
    generateSalaryPayroll,
  );

payrollPeriodRoute
  .route("/:id/review")
  .get(
    authService.protect,
    authService.allowedTo("payroll.read"),
    getPayrollReview,
  );

payrollPeriodRoute
  .route("/:id/approve")
  .patch(
    authService.protect,
    authService.allowedTo("payroll.read"),
    approvePayrollPeriod,
  );

module.exports = payrollPeriodRoute;
