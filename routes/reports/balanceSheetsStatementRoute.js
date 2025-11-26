const express = require("express");
const {
  getBalanceSheetsStatement,
} = require("../../services/reports/balanceSheetsStatementServices");
const balanceSheetsStatementRoute = express.Router();

const authService = require("../../services/authService");

balanceSheetsStatementRoute.use(authService.protect);
balanceSheetsStatementRoute.route("/").get(getBalanceSheetsStatement);

module.exports = balanceSheetsStatementRoute;
