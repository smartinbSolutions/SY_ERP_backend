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

branchRoute.route("/").get(getAllBranches).post(createBranch);

branchRoute
  .route("/:id")
  .get(getOneBranch)
  .put(updateBranch)
  .delete(deleteBranch);

module.exports = branchRoute;
