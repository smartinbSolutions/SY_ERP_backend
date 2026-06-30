const express = require("express");
const authService = require("../../../services/authService");
const {
  createLeavePolicy,
  deleteLeavePolicy,
  getAllLeavePolicies,
  getOneLeavePolicy,
  updateLeavePolicy,
} = require("../../../controllers/Hr/Leaves/leavesPolicy.controller");

const leavesPolicyRoute = express.Router();

leavesPolicyRoute
  .route("/")
  .get(authService.protect, getAllLeavePolicies)
  .post(authService.protect, createLeavePolicy);

leavesPolicyRoute
  .route("/:id")
  .get(authService.protect, getOneLeavePolicy)
  .put(authService.protect, updateLeavePolicy)
  .delete(authService.protect, deleteLeavePolicy);

module.exports = leavesPolicyRoute;
