const express = require("express");
const {
  createbudgetReport,
  getAllbudgetReport,
  getAccountForbudgetReport,
  getOneBugdgetRepor,
} = require("../../services/reports/budgetServices");

const budgetRoute = express.Router();
budgetRoute.route("/").get(getAccountForbudgetReport).post(createbudgetReport);
budgetRoute.route("/budget").get(getAllbudgetReport);
budgetRoute.route("/:id").get(getOneBugdgetRepor);
module.exports = budgetRoute;
