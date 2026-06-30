const express = require("express");
const authService = require("../../../services/authService");

const {
  createLine,
  createManyLines,
  getLines,
  getLineById,
  updateLine,
  deleteLine,
  getByPayrollEmployee,
  getSummary,
} = require("../../../controllers/Hr/Payrolls/payrollEmployeeLine.Controller");

const payrollEmployeeLineRoute = express.Router();

// ================= BASE ROUTE =================
payrollEmployeeLineRoute
  .route("/")
  .get(authService.protect, authService.allowedTo("payroll.read"), getLines)
  .post(
    authService.protect,
    authService.allowedTo("payroll.create"),
    createLine
  );

// ================= BULK CREATE =================
payrollEmployeeLineRoute
  .route("/bulk")
  .post(
    authService.protect,
    authService.allowedTo("payroll.create"),
    createManyLines
  );

// ================= BY ID =================
payrollEmployeeLineRoute
  .route("/:id")
  .get(authService.protect, authService.allowedTo("payroll.read"), getLineById)
  .patch(
    authService.protect,
    authService.allowedTo("payroll.update"),
    updateLine
  )
  .delete(
    authService.protect,
    authService.allowedTo("payroll.delete"),
    deleteLine
  );

// ================= BY PAYROLL EMPLOYEE =================
payrollEmployeeLineRoute
  .route("/by-payroll-employee/:id")
  .get(
    authService.protect,
    authService.allowedTo("payroll.read"),
    getByPayrollEmployee
  );

// ================= SUMMARY BY PERIOD =================
payrollEmployeeLineRoute
  .route("/summary/:payrollPeriodId")
  .get(authService.protect, authService.allowedTo("payroll.read"), getSummary);

module.exports = payrollEmployeeLineRoute;
