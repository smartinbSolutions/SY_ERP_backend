const express = require("express");

const {
  updataUnit,
  getUnits,
  createUnit,
  deleteUnit,
  getUnit,
} = require("../services/UnitServices");
const {
  createUnitValidator,
  getUnitValidator,
  updataUnitValidator,
  deleteUnitValidator,
} = require("../utils/validators/unitValidator");

const authService = require("../services/authService");
const unitRout = express.Router();

unitRout
  .route("/")
  .get(getUnits)
  .post(
    authService.protect,
    authService.checkCompanyEditable,
    createUnitValidator,
    createUnit,
  );
unitRout
  .route("/:id")
  .get(getUnitValidator, getUnit)
  .put(
    authService.protect,
    authService.checkCompanyEditable,
    updataUnitValidator,
    updataUnit,
  )
  .delete(
    authService.protect,
    authService.checkCompanyEditable,
    deleteUnitValidator,
    deleteUnit,
  );

module.exports = unitRout;
