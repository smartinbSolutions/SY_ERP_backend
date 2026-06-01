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
  .get(getBrands)
  .post(
    authService.protect,
    authService.checkCompanyEditable,
    uploadBrandImage,
    resizerBrandImage,
    createBrand,
  );
brandRout
  .route("/:id")
  .get(getBrand)
  .put(
    authService.protect,
    authService.checkCompanyEditable,
    uploadBrandImage,
    resizerBrandImage,
    updateBrand,
  )
  .delete(authService.protect, authService.checkCompanyEditable, deleteBrand);

module.exports = brandRout;
