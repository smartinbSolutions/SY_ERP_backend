// routes/Hr/staffFilesRoute.js
const express = require("express");
const {
  getAllStaffFiles,
  getOneStaffFile,
  updateStaffFile,
  deleteStaffFile,
  createStaffFile,
} = require("../../../services/Hr/Staffs/staffFilesService");

const authService = require("../../../services/authService");

const {
  uploadSingleStaffFile,
  processSingleStaffFile,
} = require("../../../services/Hr/Staffs/staffServices");

const staffFilesRoute = express.Router();

staffFilesRoute
  .route("/")
  .get(authService.protect, getAllStaffFiles)
  .post(
    authService.protect,
    uploadSingleStaffFile,
    processSingleStaffFile,
    createStaffFile,  
  );

staffFilesRoute
  .route("/:id")
  .get(authService.protect, getOneStaffFile)
  .put(
    authService.protect,
    uploadSingleStaffFile,
    processSingleStaffFile,
    updateStaffFile,
  )
  .delete(authService.protect, deleteStaffFile);

module.exports = staffFilesRoute;
