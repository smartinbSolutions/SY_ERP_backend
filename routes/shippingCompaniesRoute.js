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
  .get(authService.protect, authService.allowedTo("ecommerce.shipping_companies.read"), getShippingCompanies)
  .post(
    authService.protect,
    authService.checkCompanyEditable,
    uploadShippingCompanyImage,
    resizerShippingCompanyImage,
    createShippingCompany,
  );

shippingCompaniesRoute
  .route("/:id")
  .get(authService.protect, authService.allowedTo("ecommerce.shipping_companies.read"), getShippingCompany)
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
