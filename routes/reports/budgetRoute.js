const express = require("express");
const {
  getbudgetReport,
  createbudgetReport,
  getAllbudgetReport,
} = require("../../services/reports/budgetServices");

const budgetRoute = express.Router();
budgetRoute.route("/").get(getbudgetReport).post(createbudgetReport);

budgetRoute.route("/budget").get(getAllbudgetReport);
module.exports = budgetRoute;
