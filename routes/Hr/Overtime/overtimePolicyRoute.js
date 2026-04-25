const express = require("express");
const authService = require("../../../services/authService");
const {
  createPolicy,
  deletePolicy,
  getAllPolicies,
  getOnePolicy,
  updatePolicy,
} = require("../../../services/Hr/Overtime/overtimePolicyService");

const overtimePolicyRoute = express.Router();

overtimePolicyRoute
  .route("/")
  .get(authService.protect, getAllPolicies)
  .post(authService.protect, createPolicy);

overtimePolicyRoute
  .route("/:id")
  .get(authService.protect, getOnePolicy)
  .patch(authService.protect, updatePolicy)
  .delete(authService.protect, deletePolicy);

module.exports = overtimePolicyRoute;
