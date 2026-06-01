const express = require("express");

const authService = require("../../../services/authService");
const {
  getUnits,
  createUnit,
  updateUnit,
  deleteUnit,
  getUnit,
} = require("../../../controllers/Settings/Definition/unit.controller");
const unitRout = express.Router();

unitRout
  .route("/")
  .get(getUnits)
  .post(authService.protect, authService.checkCompanyEditable, createUnit);
unitRout
  .route("/:id")
  .get(getUnit)
  .put(authService.protect, authService.checkCompanyEditable, updateUnit)
  .delete(authService.protect, authService.checkCompanyEditable, deleteUnit);
module.exports = unitRout;
