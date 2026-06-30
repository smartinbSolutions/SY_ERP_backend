const express = require("express");

const authService = require("../../../services/authService");
const {
  deleteViolationLog,
  getAllViolationLogs,
  getViolationTotals,
} = require("../../../controllers/Hr/Deductions/violationLog.controller");

const violationLogRoute = express.Router();

violationLogRoute.route("/").get(authService.protect, getAllViolationLogs);

violationLogRoute.route("/totals").get(authService.protect, getViolationTotals);

violationLogRoute.route("/:id").delete(authService.protect, deleteViolationLog);

module.exports = violationLogRoute;
