const express = require("express");
const {
  createCompanyInfo,
  uploadCompanyLogo,
  resizerLogo,
  getCompanyInfo,
  updataCompanyInfo,
  rollover,
} = require("../services/companyInfoService");

const authService = require("../services/authService");

const companyInfoRoute = express.Router();

companyInfoRoute
  .route("/")
  .post(uploadCompanyLogo, resizerLogo, createCompanyInfo)
  .get(getCompanyInfo);
companyInfoRoute.route("/rollover").post(rollover);
companyInfoRoute
  .route("/:id")
  .put(authService.protect, uploadCompanyLogo, resizerLogo, updataCompanyInfo);

module.exports = companyInfoRoute;
