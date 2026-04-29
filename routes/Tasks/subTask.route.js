const express = require("express");

const authService = require("../../services/authService");
const {
  createSubTask,
  deleteSubTask,
  getAllSubTasks,
  getSubTaskById,
  updateSubTask,
} = require("../../controllers/Tasks/subtask.controller");

const hrAuthServices = require("../../services/Hr/hrAuthServices");

const subTaskRoute = express.Router();

subTaskRoute
  .route("/")
  .get(hrAuthServices.protectStaffOrERP, getAllSubTasks)
  .post(hrAuthServices.protectStaffOrERP, createSubTask);

subTaskRoute
  .route("/:id")
  .get(hrAuthServices.protectStaffOrERP, getSubTaskById)
  .put(hrAuthServices.protectStaffOrERP, updateSubTask)
  .delete(hrAuthServices.protectStaffOrERP, deleteSubTask);

module.exports = subTaskRoute;
