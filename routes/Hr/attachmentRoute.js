const express = require("express");
const multer = require("multer");

const {
  deleteAttachment,
  getAttachmentById,
  getAttachments,
  uploadAttachment,
} = require("../../controllers/Hr/attachment.controller");

const hrAuthServices = require("../../services/Hr/hrAuthServices");

const attachmentRoute = express.Router();

// multer setup
const upload = multer({
  storage: multer.memoryStorage(),
});

attachmentRoute
  .route("/")
  .get(hrAuthServices.protectStaffOrERP, getAttachments)
  .post(
    hrAuthServices.protectStaffOrERP,
    upload.single("file"), 
    uploadAttachment
  );

attachmentRoute
  .route("/:id")
  .get(hrAuthServices.protectStaffOrERP, getAttachmentById)
  .delete(hrAuthServices.protectStaffOrERP, deleteAttachment);

module.exports = attachmentRoute;