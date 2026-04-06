// routes/Hr/staffFilesRoute.js
const express = require("express");
const {
  getAllStaffFiles,
  getOneStaffFile,
  updateStaffFile,
  deleteStaffFile,
  createStaffFile,
} = require("../../services/Hr/staffFilesService");

const {
  uploadSingleStaffFile,
  processSingleStaffFile,
} = require("../../services/Hr/staffServices");

const staffFilesRoute = express.Router();

staffFilesRoute
  .route("/")
  .get(getAllStaffFiles)
  .post(uploadSingleStaffFile, processSingleStaffFile, createStaffFile);

staffFilesRoute
  .route("/:id")
  .get(getOneStaffFile)
  .put(updateStaffFile)
  .delete(deleteStaffFile);

module.exports = staffFilesRoute;
