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
  taskAccess,
  listAccess,
} = require("../../middlewares/Tasks/AccessMiddleware");

const checkPermission = require("../../middlewares/Tasks/permssionMiddleware");

// ======================================
// GLOBAL AUTHENTICATION
// ======================================

taskRoute.use(hrAuthServices.protectStaffOrERP);

// ======================================
// TASK COLLECTION
// GET  /lists/:listId/tasks
// POST /lists/:listId/tasks
// ======================================

taskRoute
  .route("/")
  .get(listAccess, checkPermission("read:task"), getAllTasks)
  .post(listAccess, checkPermission("create:task"), createTask);

// ======================================
// SINGLE TASK
// GET    /lists/:listId/tasks/:taskId
// PATCH  /lists/:listId/tasks/:taskId
// DELETE /lists/:listId/tasks/:taskId
// ======================================

taskRoute
  .route("/:taskId")
  .get(taskAccess, checkPermission("read:task"), getOneTask)
  .patch(taskAccess, checkPermission("update:task"), updateTask)
  .delete(taskAccess, checkPermission("delete:task"), deleteTask);

// ======================================
// TASK CHECKLIST
// ======================================

// ADD CHECKLIST ITEM
// POST /lists/:listId/tasks/:taskId/checklist

taskRoute.post(
  "/:taskId/checklist",
  taskAccess,
  checkPermission("update:task"),
  addChecklistItem,
);

// UPDATE CHECKLIST ITEM
// PATCH /lists/:listId/tasks/:taskId/checklist/:itemId

taskRoute.patch(
  "/:taskId/checklist/:itemId",
  taskAccess,
  checkPermission("update:task"),
  updateChecklistItem,
);

// DELETE CHECKLIST ITEM
// DELETE /lists/:listId/tasks/:taskId/checklist/:itemId

taskRoute.delete(
  "/:taskId/checklist/:itemId",
  taskAccess,
  checkPermission("update:task"),
  deleteChecklistItem,
);

// TOGGLE CHECKLIST ITEM
// PATCH /lists/:listId/tasks/:taskId/checklist/:itemId/toggle

taskRoute.patch(
  "/:taskId/checklist/:itemId/toggle",
  taskAccess,
  checkPermission("update:task"),
  toggleChecklistItem,
);

module.exports = taskRoute;
