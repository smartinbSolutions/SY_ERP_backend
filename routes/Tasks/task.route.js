const express = require("express");
const taskRoute = express.Router({ mergeParams: true });

const {
  createTask,
  deleteTask,
  getAllTasks,
  getOneTask,
  updateTask,
} = require("../../controllers/Tasks/task.controller");

const hrAuthServices = require("../../services/Hr/hrAuthServices");

const {
  workspaceAccess,
  taskAccess,
} = require("../../middlewares/Tasks/AccessMiddleware");

const checkPermission = require("../../middlewares/Tasks/permssionMiddleware");

// ======================================
// GLOBAL AUTH + WORKSPACE
// ======================================
taskRoute.use(hrAuthServices.protectStaffOrERP);
taskRoute.use(workspaceAccess);

// ======================================
// TASK COLLECTION
// GET /workspaces/:workspaceId/tasks
// POST /workspaces/:workspaceId/tasks
// ======================================
taskRoute
  .route("/")
  .get(getAllTasks)
  .post(checkPermission("create:task"), createTask);

// ======================================
// SINGLE TASK
// GET /workspaces/:workspaceId/tasks/:id
// ======================================
taskRoute
  .route("/:id")
  .get(taskAccess, getOneTask)
  .patch(taskAccess, checkPermission("update:task"), updateTask)
  .delete(taskAccess, checkPermission("delete:task"), deleteTask);

module.exports = taskRoute;
