const express = require("express");
const {
  createbudgetReport,
  getAllbudgetReport,
  getAccountForbudgetReport,
  getOneBudgetReport,
  updateBudgetReport,
  updateBudgetReportsStatus,
  relocateBudget,
} = require("../../services/reports/budgetServices");
const authService = require("../../services/authService");

const budgetRoute = express.Router();
budgetRoute.use(authService.protect);
budgetRoute.route("/").get(getAccountForbudgetReport).post(createbudgetReport);
budgetRoute.route("/budget").get(getAllbudgetReport);
budgetRoute.route("/relocateBudget").patch(relocateBudget);
budgetRoute
  .route("/:id")
  .get(getOneBudgetReport)
  .put(updateBudgetReport)
  .patch(updateBudgetReportsStatus);

module.exports = budgetRoute;
