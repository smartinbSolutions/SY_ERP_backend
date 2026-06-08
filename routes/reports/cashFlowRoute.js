const express = require("express");

const { CashFlowReports } = require("../../services/reports/cashFlowServices");
const cashFlowRoute = express.Router();
const authService = require("../../services/authService");

cashFlowRoute.use(
  authService.protect,
  authService.checkPlanFeatures("accounting"),
);
cashFlowRoute
  .route("/")
  .get(
    authService.allowedTo("reports.read", "reports.profit_loss.read"),
    CashFlowReports,
  );

module.exports = cashFlowRoute;
