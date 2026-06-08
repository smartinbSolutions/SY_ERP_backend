const express = require("express");
const {
  getClosingReports,
} = require("../../services/reports/closingReportServices");
const closingReportRoute = express.Router();
const authService = require("../../services/authService");

closingReportRoute.use(
  authService.protect,
  authService.checkPlanFeatures("accounting"),
);
closingReportRoute
  .route("/")
  .get(authService.allowedTo("reports.read"), getClosingReports);

module.exports = closingReportRoute;
