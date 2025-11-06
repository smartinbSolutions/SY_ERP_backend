const express = require("express");
const {
  getFinancialReport,
} = require("../../services/reports/incomeStatementServiices");
const incomeStatementRoute = express.Router();

incomeStatementRoute.route("/").get(getFinancialReport);

module.exports = incomeStatementRoute;
