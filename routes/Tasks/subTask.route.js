const express = require("express");

const subTaskRoute = express.Router({ mergeParams: true });

const hrAuthServices = require("../../services/Hr/hrAuthServices");

const {
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

  // CHECKLIST
  addChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  toggleChecklistItem,
} = require("../../controllers/Tasks/subtask.controller");

// ======================================
// GLOBAL AUTHENTICATION + TASK ACCESS
// ======================================

subTaskRoute.use(hrAuthServices.protectStaffOrERP);
subTaskRoute.use(taskAccess);

// ======================================
// SUBTASK COLLECTION
// GET  /tasks/:taskId/subtasks
// POST /tasks/:taskId/subtasks
// ======================================

subTaskRoute
  .route("/")
  .get(checkPermission("read:task"), getAllSubTasks)
  .post(checkPermission("create:task"), createSubTask);

// ======================================
// SINGLE SUBTASK
// GET    /tasks/:taskId/subtasks/:subTaskId
// PATCH  /tasks/:taskId/subtasks/:subTaskId
// DELETE /tasks/:taskId/subtasks/:subTaskId
// ======================================

subTaskRoute
  .route("/:subTaskId")
  .get(subTaskResolver, checkPermission("read:task"), getSubTaskById)
  .patch(subTaskResolver, checkPermission("update:task"), updateSubTask)
  .delete(subTaskResolver, checkPermission("delete:task"), deleteSubTask);

// ======================================
// SUBTASK CHECKLIST
// ======================================

// ADD CHECKLIST ITEM
// POST /tasks/:taskId/subtasks/:subTaskId/checklist

subTaskRoute.post(
  "/:subTaskId/checklist",
  subTaskResolver,
  checkPermission("update:task"),
  addChecklistItem,
);

// UPDATE CHECKLIST ITEM
// PATCH /tasks/:taskId/subtasks/:subTaskId/checklist/:itemId

subTaskRoute.patch(
  "/:subTaskId/checklist/:itemId",
  subTaskResolver,
  checkPermission("update:task"),
  updateChecklistItem,
);

// DELETE CHECKLIST ITEM
// DELETE /tasks/:taskId/subtasks/:subTaskId/checklist/:itemId

subTaskRoute.delete(
  "/:subTaskId/checklist/:itemId",
  subTaskResolver,
  checkPermission("update:task"),
  deleteChecklistItem,
);

// TOGGLE CHECKLIST ITEM
// PATCH /tasks/:taskId/subtasks/:subTaskId/checklist/:itemId/toggle

subTaskRoute.patch(
  "/:subTaskId/checklist/:itemId/toggle",
  subTaskResolver,
  checkPermission("update:task"),
  toggleChecklistItem,
);

module.exports = subTaskRoute;
