const express = require("express");
const {
  createAssetCategory,
  getAssetCategory,
  getAssetsCategory,
} = require("../services/assetCategoryService");
const authService = require("../services/authService");

const assetCategoryRoute = express.Router();
assetCategoryRoute.use(authService.protect);

assetCategoryRoute
  .route("/")
  .post(authService.checkCompanyEditable, createAssetCategory)
  .get(authService.allowedTo("assets.categories.read"), getAssetsCategory);
assetCategoryRoute
  .route("/:id")
  .get(authService.allowedTo("assets.categories.read"), getAssetCategory);

module.exports = assetCategoryRoute;
