const express = require("express");

const authService = require("../../services/authService");
const {
  deleteAttachment,
  getAttachmentById,
  getAttachments,
  uploadAttachment,

} = require("../../controllers/Hr/attachment.controller");

const attachmentRoute = express.Router();

attachmentRoute
  .route("/")
  .get(authService.protect, getAttachments)
  .post(authService.protect, uploadAttachment);

attachmentRoute
  .route("/:id")
  .get(authService.protect, getAttachmentById)
  .delete(authService.protect, deleteAttachment);

module.exports = attachmentRoute;
