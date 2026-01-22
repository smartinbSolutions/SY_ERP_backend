const express = require("express");

const authService = require("../services/authService");
const {
  getShippingCompanies,
  uploadShippingCompanyImage,
  resizerShippingCompanyImage,
  createShippingCompany,
  getShippingCompany,
  updateShippingCompany,
  deleteShippingCompany,
} = require("../services/shippingCompaniesServices");

const shippingCompaniesRoute = express.Router();

shippingCompaniesRoute
  .route("/")
  .get(getShippingCompanies)
  .post(
    authService.protect,
    authService.checkCompanyEditable,
    uploadShippingCompanyImage,
    resizerShippingCompanyImage,
    createShippingCompany,
  );

shippingCompaniesRoute
  .route("/:id")
  .get(getShippingCompany)
  .put(
    authService.protect,
    authService.checkCompanyEditable,
    uploadShippingCompanyImage,
    resizerShippingCompanyImage,
    updateShippingCompany,
  )
  .delete(
    authService.protect,
    authService.checkCompanyEditable,
    deleteShippingCompany,
  );

module.exports = shippingCompaniesRoute;
