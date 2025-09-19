const express = require("express");
const { getClosingReports } = require("../../services/reports/closingReportServices");
const closingReportRoute = express.Router();

closingReportRoute
  .route("/")
  .get(getClosingReports)

  module.exports = closingReportRoute;
