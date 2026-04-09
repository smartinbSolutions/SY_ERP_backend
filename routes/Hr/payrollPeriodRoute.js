const express = require("express");
const authService = require("../../services/authService");

const {
  createPayrollPeriod,
  deletePayrollPeriod,
  getPayrollPeriodById,
  getPayrollPeriods,
  updatePayrollPeriod,
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

module.exports = payrollPeriodRoute;
