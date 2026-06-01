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
  .get(authService.protect, authService.allowedTo("definition.read"), getUnits)
  .post(
    authService.protect,
    authService.allowedTo("definition.create"),
    authService.checkCompanyEditable,
    createUnit,
  );
unitRout
  .route("/:id")
  .get(authService.protect, authService.allowedTo("definition.read"), getUnit)
  .put(
    authService.protect,
    authService.allowedTo("definition.update"),
    authService.checkCompanyEditable,
    updateUnit,
  )
  .delete(
    authService.protect,
    authService.allowedTo("definition.delete"),
    authService.checkCompanyEditable,
    deleteUnit,
  );
module.exports = unitRout;
