const express = require("express");
const authService = require("../../../services/authService");
const staffAuthService = require("../../../services/Hr/hrAuthServices");

const {
  deleteAdvanceType,
  getAllAdvanceTypes,
  getOneAdvanceType,
  updateAdvanceType,
  createAdvanceType,
} = require("../../../controllers/Hr/Advance/advanceTypes.controller");

const advanceTypeRoute = express.Router();

advanceTypeRoute
  .route("/")
  .get(authService.protect, getAllAdvanceTypes)
  .post(authService.protect, createAdvanceType);

advanceTypeRoute
  .route("/staff")
  .get(staffAuthService.protectStaffOrERP, getAllAdvanceTypes);

advanceTypeRoute
  .route("/:id")
  .get(authService.protect, getOneAdvanceType)
  .patch(authService.protect, updateAdvanceType)
  .delete(authService.protect, deleteAdvanceType);

module.exports = advanceTypeRoute;
