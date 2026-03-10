const express = require("express");
const authService = require("../../services/authService");
const staffAuthService = require("../../services/Hr/hrAuthServices");

const {
  deleteAdvanceType,
  getAllAdvanceTypes,
  getOneAdvanceType,
  updateAdvanceType,
} = require("../../services/Hr/advanceTypesService");

const advanceTypeRoute = express.Router();

advanceTypeRoute
  .route("/")
  .get(staffAuthService.protectStaffOrERP, getAllAdvanceTypes);

advanceTypeRoute
  .route("/:id")
  .get(staffAuthService.protectStaffOrERP, getOneAdvanceType)
  .patch(authService.protect, updateAdvanceType)
  .delete(authService.protect, deleteAdvanceType);

module.exports = advanceTypeRoute;
