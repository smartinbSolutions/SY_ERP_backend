const express = require("express");

const {
  createSubTask,
  deleteSubTask,
  getAllSubTasks,
  getSubTaskById,
  updateSubTask,
} = require("../../controllers/Tasks/subtask.controller");

const hrAuthServices = require("../../services/Hr/hrAuthServices");

const {
  workspaceAccess,
  taskAccess,
} = require("../../middlewares/Tasks/AccessMiddleware");

const checkPermission = require("../../middlewares/Tasks/permssionMiddleware");

const subTaskRoute = express.Router();

subTaskRoute
  .route("/")
  .get(hrAuthServices.protectStaffOrERP, workspaceAccess, getAllSubTasks)
  .post(
    hrAuthServices.protectStaffOrERP,
    workspaceAccess,
    checkPermission("create"),
    createSubTask,
  );

subTaskRoute
  .route("/:id")
  .get(
    hrAuthServices.protectStaffOrERP,
    workspaceAccess,
    taskAccess,
    getSubTaskById,
  )
  .put(
    hrAuthServices.protectStaffOrERP,
    workspaceAccess,
    taskAccess,
    checkPermission("update"),
    updateSubTask,
  )
  .delete(
    hrAuthServices.protectStaffOrERP,
    workspaceAccess,
    taskAccess,
    checkPermission("delete"),
    deleteSubTask,
  );

module.exports = subTaskRoute;
