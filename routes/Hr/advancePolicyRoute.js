const express = require("express");
const authService = require("../../services/authService");
const {
  createPolicy,
  deletePolicy,
  getAllPolicies,
  getOnePolicy,
  updatePolicy,
} = require("../../services/Hr/advancePolicyService");

const advancePolicyRoute = express.Router();

advancePolicyRoute
  .route("/")
  .get(authService.protect, getAllPolicies)
  .post(authService.protect, createPolicy);

advancePolicyRoute
  .route("/:id")
  .get(authService.protect, getOnePolicy)
  .patch(authService.protect, updatePolicy)
  .delete(authService.protect, deletePolicy);

module.exports = advancePolicyRoute;
