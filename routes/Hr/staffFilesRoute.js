const express = require("express");
const authService = require("../../services/authService");
const {
  deleteStaffFile,
  getAllStaffFiles,
  getOneStaffFile,
  updateStaffFile,
} = require("../../services/Hr/staffFilesService");

const staffFilesRoute = express.Router();

staffFilesRoute.route("/").get(getAllStaffFiles);

staffFilesRoute
  .route("/:id")
  .get(getOneStaffFile)
  .put(updateStaffFile)
  .delete(deleteStaffFile);

module.exports = staffFilesRoute;
