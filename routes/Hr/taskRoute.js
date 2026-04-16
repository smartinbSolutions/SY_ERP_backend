const express = require("express");

const authService = require("../../services/authService");
const {
  createTask,
  deleteTask,
  getAllTasks,
  getOneTask,
  updateTask,
} = require("../../controllers/Hr/task.controller");

const taskRoute = express.Router();

taskRoute
  .route("/")
  .get(authService.protect, getAllTasks)
  .post(authService.protect, createTask);

taskRoute
  .route("/:id")
  .get(authService.protect, getOneTask)
  .put(authService.protect, updateTask)
  .delete(authService.protect, deleteTask);

module.exports = taskRoute;
