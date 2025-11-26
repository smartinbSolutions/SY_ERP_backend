const express = require("express");
const {
  getIncomeStatement,
} = require("../../services/reports/incomeStatementServiices");
const incomeStatementRoute = express.Router();
const authService = require("../../services/authService");

incomeStatementRoute.use(authService.protect);
incomeStatementRoute.route("/").get(getIncomeStatement);

module.exports = incomeStatementRoute;
