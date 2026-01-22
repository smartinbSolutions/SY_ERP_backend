const express = require("express");
const authService = require("../../services/authService");
const {
  createLeave,
  deleteLeave,
  getAllLeaves,
  getOneLeave,
  updateLeave,
} = require("../../services/Hr/leavesService");

const leavesRoute = express.Router();

leavesRoute.route("/").get(getAllLeaves).post(createLeave);

leavesRoute.route("/:id").get(getOneLeave).put(updateLeave).delete(deleteLeave);

module.exports = leavesRoute;
