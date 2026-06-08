const express = require("express");
const {
  getIncomeStatement,
} = require("../../services/reports/incomeStatementServiices");
const incomeStatementRoute = express.Router();
const authService = require("../../services/authService");

incomeStatementRoute.use(
  authService.checkPlanFeatures("accounting"),
  authService.protect,
);
incomeStatementRoute
  .route("/")
  .get(
    authService.allowedTo("reports.read", "reports.profit_loss.read"),
    getIncomeStatement,
  );

module.exports = incomeStatementRoute;
