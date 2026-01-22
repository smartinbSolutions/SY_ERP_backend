const express = require("express");
const {
  getAllRawMaterials,
  getOneRawMaterial,
  createRawMaterial,
  updateRawMaterial,
  deleteRawMaterial,
} = require("../services/resturant_management/rawMaterialsServices");

const authService = require("../services/authService");

const rawMaterialRoute = express.Router();

rawMaterialRoute
  .route("/")
  .get(getAllRawMaterials)
  .post(
    authService.protect,
    authService.checkCompanyEditable,
    createRawMaterial,
  );
brandRout
  .route("/:id")
  .get(getOneRawMaterial)
  .put(authService.protect, authService.checkCompanyEditable, updateRawMaterial)
  .delete(
    authService.protect,
    authService.checkCompanyEditable,
    deleteRawMaterial,
  );

module.exports = rawMaterialRoute;
