const express = require("express");
const authService = require("../../../services/Hr/hrAuthServices");
const {
  getAllLeaveLogs,
  getMyLeaveLogs,
} = require("../../../services/Hr/Leaves/leaveLogsService");

const leaveLogRoute = express.Router();

leaveLogRoute.route("/my").get(authService.protectStaffOrERP, getMyLeaveLogs);
leaveLogRoute.route("/").get(authService.protectStaffOrERP, getAllLeaveLogs);


module.exports = leaveLogRoute;
