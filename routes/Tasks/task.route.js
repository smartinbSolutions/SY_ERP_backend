const express = require("express");
const taskRoute = express.Router({ mergeParams: true });

const {
  createTask,
  deleteTask,
  getAllTasks,
  getOneTask,
  updateTask,

  // CHECKLIST
  addChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  toggleChecklistItem,
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
// GET /workspaces/:workspaceId/tasks/:taskId
// PATCH /workspaces/:workspaceId/tasks/:taskId
// DELETE /workspaces/:workspaceId/tasks/:taskId
// ======================================
taskRoute
  .route("/:taskId")
  .get(taskAccess, getOneTask)
  .patch(taskAccess, checkPermission("update:task"), updateTask)
  .delete(taskAccess, checkPermission("delete:task"), deleteTask);

// ======================================
// CHECKLIST ROUTES
// ======================================

// ADD CHECKLIST ITEM
// POST /workspaces/:workspaceId/tasks/:taskId/checklist
taskRoute.post(
  "/:taskId/checklist",
  taskAccess,
  checkPermission("update:task"),
  addChecklistItem,
);

// UPDATE CHECKLIST ITEM
// PATCH /workspaces/:workspaceId/tasks/:taskId/checklist/:itemId
taskRoute.patch(
  "/:taskId/checklist/:itemId",
  taskAccess,
  checkPermission("update:task"),
  updateChecklistItem,
);

// DELETE CHECKLIST ITEM
// DELETE /workspaces/:workspaceId/tasks/:taskId/checklist/:itemId
taskRoute.delete(
  "/:taskId/checklist/:itemId",
  taskAccess,
  checkPermission("update:task"),
  deleteChecklistItem,
);

// TOGGLE CHECKLIST ITEM
// PATCH /workspaces/:workspaceId/tasks/:taskId/checklist/:itemId/toggle
taskRoute.patch(
  "/:taskId/checklist/:itemId/toggle",
  taskAccess,
  checkPermission("update:task"),
  toggleChecklistItem,
);

module.exports = taskRoute;
