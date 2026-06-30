const express = require("express");
const authService = require ("../../../services/authService");
const {
  createDepartment,
  deleteDepartment,
  getAllDepartments,
  getOneDepartment,
  updateDepartment,
} = require("../../../services/Hr/Company_Hierarchy/departmentServices");

const departmentRoute = express.Router();

departmentRoute
  .route("/")
  .get(
    authService.protect,
    authService.allowedTo("hr.settings.read"),
    getAllDepartments,
  )
  .post(
    authService.protect,
    authService.allowedTo("hr.settings.create"),
    createDepartment,
  );

departmentRoute
  .route("/:id")
  .get(
    authService.protect,
    authService.allowedTo("hr.settings.read"),
    getOneDepartment,
  )
  .put(
    authService.protect,
    authService.allowedTo("hr.settings.update"),
    updateDepartment,
  )
  .delete(
    authService.protect,
    authService.allowedTo("hr.settings.delete"),
    deleteDepartment,
  );

module.exports = departmentRoute;
