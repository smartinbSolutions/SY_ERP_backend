const express = require("express");
const {
  getBalanceSheetsStatement,
} = require("../../services/reports/balanceSheetsStatementServices");
const balanceSheetsStatementRoute = express.Router();

balanceSheetsStatementRoute.route("/").get(getBalanceSheetsStatement);

module.exports = balanceSheetsStatementRoute;
