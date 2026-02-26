const express = require("express");
const authService = require("../../services/Hr/hrAuthServices");
const {
  getAllAdvanceLogs,
  getMyAdvanceLogs,
} = require("../../services/Hr/advanceLogsService");

const advanceLogRoute = express.Router();

advanceLogRoute
  .route("/my")
  .get(authService.protectStaffOrERP, getMyAdvanceLogs);
advanceLogRoute
  .route("/")
  .get(authService.protectStaffOrERP, getAllAdvanceLogs);

module.exports = advanceLogRoute;
