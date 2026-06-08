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

rawMaterialRoute.use(
  authService.protect,
  authService.checkPlanFeatures("resturant"),
);
rawMaterialRoute
  .route("/")
  .get(getAllRawMaterials)
  .post(authService.checkCompanyEditable, createRawMaterial);
rawMaterialRoute
  .route("/:id")
  .get(getOneRawMaterial)
  .put(authService.checkCompanyEditable, updateRawMaterial)
  .delete(authService.checkCompanyEditable, deleteRawMaterial);

module.exports = rawMaterialRoute;
