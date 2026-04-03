const express = require("express");
const authService = require("../../services/authService");
const staffAuthService = require("../../services/Hr/hrAuthServices");

const {
  createLeave,
  deleteLeave,
  getAllLeaves,
  getOneLeave,
  updateLeave,
} = require("../../services/Hr/leavesService");

const leavesRoute = express.Router();

leavesRoute
  .route("/")
  .get(authService.protect, getAllLeaves)
  .post(authService.protect, createLeave);

leavesRoute
  .route("/staff")
  .get(
    staffAuthService.protectStaffOrERP, 
    getAllLeaves);

leavesRoute
  .route("/:id")
  .get(authService.protect, getOneLeave)
  .put(authService.protect, updateLeave)
  .delete(authService.protect, deleteLeave);

module.exports = leavesRoute;
