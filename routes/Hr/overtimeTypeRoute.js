const express = require("express");
const authService = require("../../services/authService");
// const staffAuthService = require("../../services/Hr/hrAuthServices");

const {
  createOvertimeType,
  deleteOvertimeType,
  getAllOvertimeTypes,
  getOneOvertimeType,
  updateOvertimeType,
} = require("../../services/Hr/overtimeTypeService");

const overtimeTypeRoute = express.Router();

overtimeTypeRoute
  .route("/")
  .get(authService.protect, getAllOvertimeTypes)
  .post(authService.protect, createOvertimeType);

overtimeTypeRoute
  .route("/:id")
  .get(authService.protect, getOneOvertimeType)
  .patch(authService.protect, updateOvertimeType)
  .delete(authService.protect, deleteOvertimeType);

module.exports = overtimeTypeRoute;
