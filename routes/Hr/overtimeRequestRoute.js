const express = require("express");
const {
  createOvertimeRequest,
  deleteOvertimeRequest,
  getAllOvertimeRequests,
  getMyOvertimeRequests,
  getOvertimeRequestById,
  handleOvertimeRequest,
  processOvertimeAttachment,
  updateOvertimeRequest,
  uploadOvertimeAttachment,
} = require("../../services/Hr/overtimeRequestService");

const hrAuthServices = require("../../services/Hr/hrAuthServices");

const overtimeRequestRouter = express.Router();

overtimeRequestRouter
  .route("/my-requests")
  .get(hrAuthServices.protectStaffOrERP, getMyOvertimeRequests);

overtimeRequestRouter
  .route("/")
  .post(
    hrAuthServices.protectStaffOrERP,
    uploadOvertimeAttachment,
    processOvertimeAttachment,
    createOvertimeRequest,
  )
  .get(getAllOvertimeRequests);

overtimeRequestRouter
  .route("/handle-overtime-status/:id")
  .post(hrAuthServices.protectStaffOrERP, handleOvertimeRequest);

overtimeRequestRouter
  .route("/:id")
  .get(hrAuthServices.protectStaffOrERP, getOvertimeRequestById)
  .patch(
    hrAuthServices.protectStaffOrERP,
    uploadOvertimeAttachment,
    processOvertimeAttachment,
    updateOvertimeRequest,
  )
  .delete(hrAuthServices.protectStaffOrERP, deleteOvertimeRequest);


module.exports = overtimeRequestRouter;
