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
// GLOBAL AUTH
// ======================================
subTaskRoute.use(hrAuthServices.protectStaffOrERP);

// ======================================
// SUBTASK COLLECTION
// GET /workspaces/:workspaceId/tasks/:taskId/subtasks
// POST /workspaces/:workspaceId/tasks/:taskId/subtasks
// ======================================
subTaskRoute
  .route("/")
  .get(taskAccess, getAllSubTasks)
  .post(taskAccess, checkPermission("create:task"), createSubTask);

// ======================================
// SINGLE SUBTASK
// GET /workspaces/:workspaceId/tasks/:taskId/subtasks/:subTaskId
// PATCH /workspaces/:workspaceId/tasks/:taskId/subtasks/:subTaskId
// DELETE /workspaces/:workspaceId/tasks/:taskId/subtasks/:subTaskId
// ======================================
subTaskRoute
  .route("/:subTaskId")
  .get(taskAccess, subTaskResolver, getSubTaskById)
  .patch(
    taskAccess,
    subTaskResolver,
    checkPermission("update:task"),
    updateSubTask,
  )
  .delete(
    taskAccess,
    subTaskResolver,
    checkPermission("delete:task"),
    deleteSubTask,
  );

// ======================================
// CHECKLIST ROUTES (SUBTASK)
// ======================================

// ADD CHECKLIST ITEM
// POST /workspaces/:workspaceId/tasks/:taskId/subtasks/:subTaskId/checklist
subTaskRoute.post(
  "/:subTaskId/checklist",

  taskAccess,
  subTaskResolver,
  checkPermission("update:task"),
  addChecklistItem,
);

// UPDATE CHECKLIST ITEM
// PATCH /workspaces/:workspaceId/tasks/:taskId/subtasks/:subTaskId/checklist/:itemId
subTaskRoute.patch(
  "/:subTaskId/checklist/:itemId",

  taskAccess,
  subTaskResolver,
  checkPermission("update:task"),
  updateChecklistItem,
);

// DELETE CHECKLIST ITEM
// DELETE /workspaces/:workspaceId/tasks/:taskId/subtasks/:subTaskId/checklist/:itemId
subTaskRoute.delete(
  "/:subTaskId/checklist/:itemId",

  taskAccess,
  subTaskResolver,
  checkPermission("update:task"),
  deleteChecklistItem,
);

// TOGGLE CHECKLIST ITEM
// PATCH /workspaces/:workspaceId/tasks/:taskId/subtasks/:subTaskId/checklist/:itemId/toggle
subTaskRoute.patch(
  "/:subTaskId/checklist/:itemId/toggle",

  taskAccess,
  subTaskResolver,
  checkPermission("update:task"),
  toggleChecklistItem,
);

module.exports = subTaskRoute;
