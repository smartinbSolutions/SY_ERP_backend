const express = require("express");
const authService = require("../../services/authService");

const {
  createPayrollGroup,
  deletePayrollGroup,
  getPayrollGroups,
  getPayrollGroupById,
  updatePayrollGroup,
} = require("../../controllers/Hr/payrollGroups.controller");

const payrollGroupRoute = express.Router();

payrollGroupRoute
  .route("/")
  .get(authService.protect, getPayrollGroups)
  .post(authService.protect, createPayrollGroup);

payrollGroupRoute
  .route("/:id")
  .get(authService.protect, getPayrollGroupById)
  .patch(authService.protect, updatePayrollGroup)
  .delete(authService.protect, deletePayrollGroup);

module.exports = payrollGroupRoute;
