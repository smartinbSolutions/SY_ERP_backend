const express = require("express");
const authService = require("../../services/Hr/hrAuthServices");
const {
  getAllAdvanceLogs,
  getMyAdvanceLogs,
} = require("../../controllers/Hr/advanceLogs.controller");

const advanceLogRoute = express.Router();

advanceLogRoute
  .route("/my")
  .get(authService.protectStaffOrERP, getMyAdvanceLogs);
advanceLogRoute
  .route("/")
  .get(authService.protectStaffOrERP, getAllAdvanceLogs);

module.exports = advanceLogRoute;
