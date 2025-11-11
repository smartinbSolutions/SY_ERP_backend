const express = require("express");
const {
  getIncomeStatement,
} = require("../../services/reports/incomeStatementServiices");
const incomeStatementRoute = express.Router();

incomeStatementRoute.route("/").get(getIncomeStatement);

module.exports = incomeStatementRoute;
