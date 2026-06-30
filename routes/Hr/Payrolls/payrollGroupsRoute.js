const express = require("express");
const authService = require("../../../services/authService");

const {
  createPayrollGroup,
  deletePayrollGroup,
  getPayrollGroups,
  getPayrollGroupById,
  updatePayrollGroup,
} = require("../../../controllers/Hr/Payrolls/payrollGroups.controller");

const payrollGroupRoute = express.Router();

payrollGroupRoute
  .route("/")
  .get(
    authService.protect,
    authService.allowedTo("payroll.read"),
    getPayrollGroups,
  )
  .post(
    authService.protect,
    authService.allowedTo("payroll.create"),
    createPayrollGroup,
  );

payrollGroupRoute
  .route("/:id")
  .get(
    authService.protect,
    authService.allowedTo("payroll.read"),
    getPayrollGroupById,
  )
  .patch(
    authService.protect,
    authService.allowedTo("payroll.update"),
    updatePayrollGroup,
  )
  .delete(
    authService.protect,
    authService.allowedTo("payroll.delete"),
    deletePayrollGroup,
  );

module.exports = payrollGroupRoute;
