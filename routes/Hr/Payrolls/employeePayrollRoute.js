const express = require("express");
const authService = require("../../../services/authService");

const {
  getEmployeePayrolls,
} = require("../../../controllers/Hr/Payrolls/employeePayroll.controller");

const employeePayrollRoute = express.Router();

employeePayrollRoute
  .route("/")
  .get(
    authService.protect,
    authService.allowedTo("payroll.read"),
    getEmployeePayrolls,
  );

module.exports = employeePayrollRoute;
