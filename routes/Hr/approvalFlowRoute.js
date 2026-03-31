const express = require("express");
const authService = require("../../services/authService");
const {
  createApprovalFlow,
  deleteApprovalFlow,
  getAllApprovalFlows,
  getOneApprovalFlow,
  updateApprovalFlow,
} = require("../../controllers/Hr/approvalFlow.controller");

const approvalFlowRoute = express.Router();

approvalFlowRoute
  .route("/")
  .get(authService.protect, getAllApprovalFlows)
  .post(authService.protect, createApprovalFlow);

approvalFlowRoute
  .route("/:id")
  .get(authService.protect, getOneApprovalFlow)
  .patch(authService.protect, updateApprovalFlow)
  .delete(authService.protect, deleteApprovalFlow);

module.exports = approvalFlowRoute;