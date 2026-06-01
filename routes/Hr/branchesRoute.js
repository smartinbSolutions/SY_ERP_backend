const express = require("express");
const authService = require("../../services/authService");
const {
  createBranch,
  deleteBranch,
  getAllBranches,
  getOneBranch,
  updateBranch,
} = require("../../services/Hr/branchesServices");

const branchRoute = express.Router();

branchRoute
  .route("/")
  .get(authService.protect, authService.allowedTo("hr.settings.read"), getAllBranches)
  .post(authService.protect, authService.allowedTo("hr.settings.create"), createBranch);

branchRoute
  .route("/:id")
  .get(authService.protect, authService.allowedTo("hr.settings.read"), getOneBranch)
  .put(authService.protect, authService.allowedTo("hr.settings.update"), updateBranch)
  .delete(authService.protect, authService.allowedTo("hr.settings.delete"), deleteBranch);

module.exports = branchRoute;
