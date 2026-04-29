const express = require("express");

const authService = require("../../services/authService");
const {
  createTimeLog,
  deleteTimeLog,
  getAllTimeLogs,
  getTimeLog,
  updateTimeLog,
} = require("../../controllers/Tasks/timeTracking.controller");

const hrAuthServices = require("../../services/Hr/hrAuthServices");

const timeTrackingRoute = express.Router();

timeTrackingRoute
  .route("/")
  .get(hrAuthServices.protectStaffOrERP, getAllTimeLogs)
  .post(hrAuthServices.protectStaffOrERP, createTimeLog);

timeTrackingRoute
  .route("/:id")
  .get(hrAuthServices.protectStaffOrERP, getTimeLog)
  .patch(hrAuthServices.protectStaffOrERP, updateTimeLog)
  .delete(hrAuthServices.protectStaffOrERP, deleteTimeLog);

module.exports = timeTrackingRoute;
