const express = require("express");

const quickReportsRoute = express.Router();
const authService = require("../../services/authService");
const {
  getExpensesReport,
} = require("../../controllers/Accounting/Reports/quickReports.controller");

quickReportsRoute.use(
  authService.protect,
  authService.checkPlanFeatures("accounting"),
);

quickReportsRoute
  .route("/expenses")
  .get(authService.allowedTo("reports.read"), getExpensesReport);

// quickReportsRoute.route("/sales").get(authService.allowedTo("reports.read"), getSalesReport);
// quickReportsRoute.route("/purchases").get(authService.allowedTo("reports.read"), getPurchaseReport);

module.exports = quickReportsRoute;
