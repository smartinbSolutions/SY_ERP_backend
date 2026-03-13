const express = require("express");
const {
  createLeaveRequest,
  getMyLeaveRequests,
  getAllLeaveRequests,
  getLeaveRequestById,
  updateLeaveRequest,
  deleteLeaveRequest,
  handleLeaveRequest,
  processLeaveAttachment,
  uploadLeaveAttachment,
  getMyApprovals,
} = require("../../services/Hr/leaveRequestService");

const hrAuthServices = require("../../services/Hr/hrAuthServices");

const LeaveRequestRouter = express.Router();

LeaveRequestRouter.route("/my-requests").get(
  hrAuthServices.protectStaffOrERP,
  getMyLeaveRequests,
);
LeaveRequestRouter.route("/my-approvals").get(
  hrAuthServices.protectStaffOrERP,
  getMyApprovals,
);

LeaveRequestRouter.route("/")
  .post(
    hrAuthServices.protectStaffOrERP,
    uploadLeaveAttachment,
    processLeaveAttachment,
    createLeaveRequest,
  )
  .get(getAllLeaveRequests);

LeaveRequestRouter.route("/handle-leave-status/:id").post(
  hrAuthServices.protectStaffOrERP,
  handleLeaveRequest,
);

LeaveRequestRouter.route("/:id")
  .get(hrAuthServices.protectStaffOrERP, getLeaveRequestById)
  .put(
    hrAuthServices.protectStaffOrERP,
    uploadLeaveAttachment,
    processLeaveAttachment,
    updateLeaveRequest,
  )
  .delete(hrAuthServices.protectStaffOrERP, deleteLeaveRequest);

module.exports = LeaveRequestRouter;
