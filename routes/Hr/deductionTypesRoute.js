const express = require("express");
const authService = require("../../services/authService");
const staffAuthService = require("../../services/Hr/hrAuthServices");

const {
  createDeductionType,
  deleteDeductionType,
  getAllDeductionTypes,
  getOneDeductionType,
  updateDeductionType,
} = require("../../services/Hr/deductionTypesService");

const deductionTypeRoute = express.Router();

deductionTypeRoute
  .route("/")
  .get(authService.protect, getAllDeductionTypes)
  .post(authService.protect, createDeductionType);

deductionTypeRoute
  .route("/staff")
  .get(staffAuthService.protectStaffOrERP, getAllDeductionTypes);
deductionTypeRoute
  .route("/:id")
  .get(authService.protect, getOneDeductionType)
  .patch(authService.protect, updateDeductionType)
  .delete(authService.protect, deleteDeductionType);

module.exports = deductionTypeRoute;
