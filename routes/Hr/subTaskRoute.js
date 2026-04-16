const express = require("express");

const authService = require("../../services/authService");
const {
  createSubTask,
  deleteSubTask,
  getAllSubTasks,
  getSubTaskById,
  updateSubTask,
} = require("../../controllers/Hr/subtask.controller");

const subTaskRoute = express.Router();

subTaskRoute
  .route("/")
  .get(authService.protect, getAllSubTasks)
  .post(authService.protect, createSubTask);

subTaskRoute
  .route("/:id")
  .get(authService.protect, getSubTaskById)
  .put(authService.protect, updateSubTask)
  .delete(authService.protect, deleteSubTask);

module.exports = subTaskRoute;
