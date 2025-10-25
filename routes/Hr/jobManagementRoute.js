const express = require("express");
const authService = require("../../services/authService");
const {
  createJobs,
  deleteJob,
  getAllJobs,
  getOneJob,
  updateJob,
  resizeCompanyLogo,
  uploadCompanyLogo,
} = require("../../services/Hr/jobManagementService");

const jobRoute = express.Router();

jobRoute
  .route("/")
  .get(getAllJobs)
  .post(uploadCompanyLogo, resizeCompanyLogo, createJobs);

jobRoute
  .route("/:id")
  .get(getOneJob)
  .put(uploadCompanyLogo, resizeCompanyLogo, updateJob)
  .delete(deleteJob);

module.exports = jobRoute;
