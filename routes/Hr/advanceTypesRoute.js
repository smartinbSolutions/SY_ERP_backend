const express = require("express");
const authService = require("../../services/authService");
const {
  deleteAdvanceType,
  getAllAdvanceTypes,
  getOneAdvanceType,
  updateAdvanceType,
} = require("../../services/Hr/advanceTypesService");

const advanceTypeRoute = express.Router();

advanceTypeRoute.route("/").get(authService.protect, getAllAdvanceTypes);

advanceTypeRoute
  .route("/:id")
  .get(authService.protect, getOneAdvanceType)
  .patch(authService.protect, updateAdvanceType)
  .delete(authService.protect, deleteAdvanceType);

module.exports = advanceTypeRoute;
