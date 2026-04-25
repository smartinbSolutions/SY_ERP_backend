const express = require("express");

const authService = require("../../services/authService");
const {
  getActionExecutionLogs,
} = require("../../controllers/Hr/actionExecutionLog.controller");

const actionExecutionRoute = express.Router();

actionExecutionRoute
  .route("/")
  .get(authService.protect, getActionExecutionLogs);

module.exports = actionExecutionRoute;
