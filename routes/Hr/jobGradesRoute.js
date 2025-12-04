const express = require("express");
const authService = require("../../services/authService");
const {
  createGrades,
  deleteGrades,
  getAllGrades,
  getOneGrade,
  updateGrades,
} = require("../../services/Hr/jobGradesService");

const jobGradesRoute = express.Router();

jobGradesRoute.route("/").get(getAllGrades).post(createGrades);

jobGradesRoute
  .route("/:id")
  .get(getOneGrade)
  .put(updateGrades)
  .delete(deleteGrades);

module.exports = jobGradesRoute;
