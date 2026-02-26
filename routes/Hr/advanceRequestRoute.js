const express = require("express");
const {
  createAdvanceRequest,
  deleteAdvanceRequest,
  getAdvanceRequestById,
  getAllAdvanceRequests,
  getMyAdvanceRequests,
  handleAdvanceRequest,
  processAdvanceAttachment,
  updateAdvanceRequest,
  uploadAdvanceAttachment,
} = require("../../services/Hr/advanceRequestService");

const hrAuthServices = require("../../services/Hr/hrAuthServices");

const advanceRequestRouter = express.Router();

advanceRequestRouter
  .route("/my-requests")
  .get(hrAuthServices.protectStaffOrERP, getMyAdvanceRequests);

advanceRequestRouter
  .route("/")
  .post(
    hrAuthServices.protectStaffOrERP,
    uploadAdvanceAttachment,
    processAdvanceAttachment,
    createAdvanceRequest,
  )
  .get(getAllAdvanceRequests);

advanceRequestRouter
  .route("/handle-advance-status/:id")
  .post(hrAuthServices.protectStaffOrERP, handleAdvanceRequest);

advanceRequestRouter
  .route("/:id")
  .get(hrAuthServices.protectStaffOrERP, getAdvanceRequestById)
  .patch(
    hrAuthServices.protectStaffOrERP,
    uploadAdvanceAttachment,
    processAdvanceAttachment,
    updateAdvanceRequest,
  )
  .delete(hrAuthServices.protectStaffOrERP, deleteAdvanceRequest);


module.exports = advanceRequestRouter;
