const express = require("express");
const subTaskRoute = express.Router({ mergeParams: true });

const hrAuthServices = require("../../services/Hr/hrAuthServices");

const {
  workspaceAccess,
  taskAccess,
  subTaskResolver,
} = require("../../middlewares/Tasks/AccessMiddleware");

const checkPermission = require("../../middlewares/Tasks/permssionMiddleware");

const {
  createSubTask,
  deleteSubTask,
  getAllSubTasks,
  getSubTaskById,
  updateSubTask,
} = require("../../controllers/Tasks/subtask.controller");

// ======================================
// GLOBAL AUTH
// ======================================
subTaskRoute.use(hrAuthServices.protectStaffOrERP);

// ======================================
// GET ALL SUBTASKS (of task)
// GET /workspaces/:workspaceId/tasks/:taskId/subtasks
// ======================================
subTaskRoute.get("/", workspaceAccess, taskAccess, getAllSubTasks);

// ======================================
// CREATE SUBTASK
// POST /workspaces/:workspaceId/tasks/:taskId/subtasks
// ======================================
subTaskRoute.post(
  "/",
  workspaceAccess,
  taskAccess,
  checkPermission("create:task"),
  createSubTask,
);

// ======================================
// SINGLE SUBTASK
// GET /workspaces/:workspaceId/tasks/:taskId/subtasks/:subTaskId
// ======================================
subTaskRoute.get(
  "/:subTaskId",
  workspaceAccess,
  taskAccess,
  subTaskResolver,
  getSubTaskById,
);

// ======================================
// UPDATE SUBTASK
// PUT /workspaces/:workspaceId/tasks/:taskId/subtasks/:subTaskId
// ======================================
subTaskRoute.put(
  "/:subTaskId",
  workspaceAccess,
  taskAccess,
  subTaskResolver,
  checkPermission("update:task"),
  updateSubTask,
);

// ======================================
// DELETE SUBTASK
// DELETE /workspaces/:workspaceId/tasks/:taskId/subtasks/:subTaskId
// ======================================
subTaskRoute.delete(
  "/:subTaskId",
  workspaceAccess,
  taskAccess,
  subTaskResolver,
  checkPermission("delete:task"),
  deleteSubTask,
);

module.exports = subTaskRoute;
