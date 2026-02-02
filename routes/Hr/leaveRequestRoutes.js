// routes/Hr/leaveRequestRoutes.js

const express = require("express");
const {
  createLeaveRequest,
  getMyLeaveRequests,
  getAllLeaveRequests,
  getLeaveRequestById,
  updateLeaveRequest,
  deleteLeaveRequest,
  changeLeaveRequestStatus,
} = require("../../services/Hr/leaveRequestService");

const hrAuthServices = require("../../services/Hr/hrAuthServices");

const LeaveRequestRouter = express.Router();

/* ================= USER ROUTES ================= */

LeaveRequestRouter.route("/my-requests").get(
  hrAuthServices.protectStaffOrERP,
  getMyLeaveRequests,
);

LeaveRequestRouter.route("/")
  .post(hrAuthServices.protectStaffOrERP, createLeaveRequest)
  .get(getAllLeaveRequests);

LeaveRequestRouter.route("/:id")
  .get(hrAuthServices.protectStaffOrERP, getLeaveRequestById)
  .put(hrAuthServices.protectStaffOrERP, updateLeaveRequest)
  .delete(hrAuthServices.protectStaffOrERP, deleteLeaveRequest);

LeaveRequestRouter.route("/:id/status").put(
  hrAuthServices.protectStaffOrERP,
  changeLeaveRequestStatus,
);

module.exports = LeaveRequestRouter;
