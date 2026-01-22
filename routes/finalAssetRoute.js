const express = require("express");
const {
  createFinalAsset,
  deleteFinalAsset,
  getFinalAsset,
  getFinalAssets,
  updateFinalAsset,
} = require("../services/finalAssetService");
const authService = require("../services/authService");

const finalAsset = express.Router();
finalAsset.use(authService.protect);

finalAsset
  .route("/")
  .post(authService.checkCompanyEditable, createFinalAsset)
  .get(getFinalAssets);
finalAsset
  .route("/:id")
  .get(getFinalAsset)
  .put(authService.checkCompanyEditable, updateFinalAsset)
  .delete(authService.checkCompanyEditable, deleteFinalAsset);

module.exports = finalAsset;
