const express = require("express");

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

const taskRoute = express.Router();

// TASK COLLECTION
taskRoute
  .route("/")
  .get(hrAuthServices.protectStaffOrERP, workspaceAccess, getAllTasks)
  .post(
    hrAuthServices.protectStaffOrERP,
    workspaceAccess,
    checkPermission("create:task"),
    createTask,
  );

// SINGLE TASK
taskRoute
  .route("/:id")
  .get(
    hrAuthServices.protectStaffOrERP,
    workspaceAccess,
    taskAccess,
    getOneTask,
  )
  .patch(
    hrAuthServices.protectStaffOrERP,
    workspaceAccess,
    taskAccess,
    checkPermission("update:task"),
    updateTask,
  )
  .delete(
    hrAuthServices.protectStaffOrERP,
    workspaceAccess,
    taskAccess,
    checkPermission("delete:task"),
    deleteTask,
  );

module.exports = taskRoute;
