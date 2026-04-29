const express = require("express");

const authService = require("../../services/authService");
const {
  createTask,
  deleteTask,
  getAllTasks,
  getOneTask,
  updateTask,
} = require("../../controllers/Tasks/task.controller");

const hrAuthServices = require("../../services/Hr/hrAuthServices");

const taskRoute = express.Router();

taskRoute
  .route("/")
  .get(hrAuthServices.protectStaffOrERP, getAllTasks)
  .post(hrAuthServices.protectStaffOrERP, createTask);

taskRoute
  .route("/:id")
  .get(hrAuthServices.protectStaffOrERP, getOneTask)
  .patch(hrAuthServices.protectStaffOrERP, updateTask)
  .delete(hrAuthServices.protectStaffOrERP, deleteTask);

module.exports = taskRoute;
