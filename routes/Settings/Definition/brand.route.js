const express = require("express");

const authService = require("../../../services/authService");
const {
  getBrands,
  createBrand,
  getBrand,
  updateBrand,
  deleteBrand,
  uploadBrandImage,
  resizerBrandImage,
} = require("../../../controllers/Settings/Definition/brand.controller");
const brandRout = express.Router();

brandRout
  .route("/")
  .get(authService.protect, authService.allowedTo("definition.read"), getBrands)
  .post(
    authService.protect,
    authService.allowedTo("definition.create"),
    authService.checkCompanyEditable,
    uploadBrandImage,
    resizerBrandImage,
    createBrand,
  );
brandRout
  .route("/:id")
  .get(authService.protect, authService.allowedTo("definition.read"), getBrand)
  .put(
    authService.protect,
    authService.allowedTo("definition.update"),
    authService.checkCompanyEditable,
    uploadBrandImage,
    resizerBrandImage,
    updateBrand,
  )
  .delete(
    authService.protect,
    authService.allowedTo("definition.delete"),
    authService.checkCompanyEditable,
    deleteBrand,
  );

module.exports = brandRout;
