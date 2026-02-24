const express = require("express");
const authService = require("../../services/Hr/hrAuthServices");
const {
  getAllOvertimeLogs,
  getMyOvertimeLogs,
} = require("../../services/Hr/overtimeLogsService");

const overtimeLogRoute = express.Router();

overtimeLogRoute
  .route("/my")
  .get(authService.protectStaffOrERP, getMyOvertimeLogs);
overtimeLogRoute
  .route("/")
  .get(authService.protectStaffOrERP, getAllOvertimeLogs);

module.exports = overtimeLogRoute;
