const express = require("express");
const authService = require("../../services/authService");
const {
  createJobs,
  deleteJob,
  getAllJobs,
  getOneJob,
  updateJob,
} = require("../../services/Hr/jobManagementService");

const jobRoute = express.Router();

jobRoute.route("/").get(getAllJobs).post(createJobs);

jobRoute.route("/:id").get(getOneJob).put(updateJob).delete(deleteJob);

module.exports = jobRoute;
