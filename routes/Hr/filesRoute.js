const express = require("express");
const authService = require("../../services/authService");
const {
  createFile,
  deleteFile,
  getAllFiles,
  getOneFile,
  updateFile,
} = require("../../services/Hr/filesService");

const filesRoute = express.Router();

filesRoute
  .route("/")
  .get(authService.protect, authService.allowedTo("hr.settings.read"), getAllFiles)
  .post(authService.protect, authService.allowedTo("hr.settings.create"), createFile);

filesRoute
  .route("/:id")
  .get(authService.protect, authService.allowedTo("hr.settings.read"), getOneFile)
  .put(authService.protect, authService.allowedTo("hr.settings.update"), updateFile)
  .delete(authService.protect, authService.allowedTo("hr.settings.delete"), deleteFile);

module.exports = filesRoute;
