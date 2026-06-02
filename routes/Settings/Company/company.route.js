const express = require("express");

const authService = require("../../../services/authService");
const {
  updateCompanyInfo,
  getCompanyInfo,
  getCompanySetting,
  createCompanyInfo,
  updateCompanySetting,
  uploadCompanyLogo,
  resizerLogo,
} = require("../../../controllers/Settings/Company/companyInfo.controller");

const companyInfoRoute = express.Router();

companyInfoRoute
  .route("/")
  .post(uploadCompanyLogo, resizerLogo, createCompanyInfo)
  .get(authService.protect, authService.allowedTo("company.read"), getCompanyInfo);

companyInfoRoute
  .route("/setting")
  .get(
    authService.protect,
    authService.allowedTo("company.read"),
    getCompanySetting,
  )
  .put(
    authService.protect,
    authService.allowedTo("company.update"),
    authService.checkCompanyEditable,
    updateCompanySetting,
  );

companyInfoRoute
  .route("/:id")
  .put(
    authService.protect,
    authService.allowedTo("company.update"),
    authService.checkCompanyEditable,
    uploadCompanyLogo,
    resizerLogo,
    updateCompanyInfo,
  );

module.exports = companyInfoRoute;
