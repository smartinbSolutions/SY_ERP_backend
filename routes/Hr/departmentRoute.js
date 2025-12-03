const express = require("express");
const authService = require("../../services/authService");
const {
  createDepartment,
  deleteDepartment,
  getAllDepartments,
  getOneDepartment,
  updateDepartment,
} = require("../../services/Hr/departmentServices");

const departmentRoute = express.Router();

departmentRoute.route("/").get(getAllDepartments).post(createDepartment);

departmentRoute
  .route("/:id")
  .get(getOneDepartment)
  .put(updateDepartment)
  .delete(deleteDepartment);

module.exports = departmentRoute;
