const express = require("express");
const authService = require("../../../services/authService");
const {
  createLeavePolicy,
  deleteLeavePolicy,
  getAllLeavePolicies,
  getOneLeavePolicy,
  updateLeavePolicy,
} = require("../../../services/Hr/Leaves/leavesPolicyService");

const leavesPolicyRoute = express.Router();

leavesPolicyRoute.route("/").get(getAllLeavePolicies).post(createLeavePolicy);

leavesPolicyRoute
  .route("/:id")
  .get(getOneLeavePolicy)
  .put(updateLeavePolicy)
  .delete(deleteLeavePolicy);

module.exports = leavesPolicyRoute;
