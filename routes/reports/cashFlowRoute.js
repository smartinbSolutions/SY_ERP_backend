const express = require("express");

const { CashFlowReports } = require("../../services/reports/cashFlowServices");
const cashFlowRoute = express.Router();

cashFlowRoute.route("/").get(CashFlowReports);

module.exports = cashFlowRoute;
