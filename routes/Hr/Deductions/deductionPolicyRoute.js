const express = require("express");
const authService = require("../../../services/authService");
const {
  createPolicy,
  deletePolicy,
  getAllPolicies,
  getOnePolicy,
  updatePolicy,
} = require("../../../services/Hr/Deductions/deductionPolicyService");

const deductionPolicyRoute = express.Router();

deductionPolicyRoute
  .route("/")
  .get(authService.protect, getAllPolicies)
  .post(authService.protect, createPolicy);

deductionPolicyRoute
  .route("/:id")
  .get(authService.protect, getOnePolicy)
  .patch(authService.protect, updatePolicy)
  .delete(authService.protect, deletePolicy);

module.exports = deductionPolicyRoute;
