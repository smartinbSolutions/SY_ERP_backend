const express = require("express");
const {
  createInvestmentCompanies,
  getAllInvestmentCompaniess,
  getOneInvestmentCompanies,
  updateInvestmentCompanies,
  deleteInvestmentCompanies,
  resizeInvestmentCompaniesImages,
  uploadInvestmentCompaniesImage,
  uploadInvestmentCompaniesImages,
} = require("../../services/investment/investmentCompaniesService");
const authService = require("../../services/authService");

const investmentCompaniesRoute = express.Router();

investmentCompaniesRoute
  .route("/")
  .post(
    authService.protect,
    uploadInvestmentCompaniesImage,
    resizeInvestmentCompaniesImages,
    createInvestmentCompanies
  )
  .get(getAllInvestmentCompaniess);
investmentCompaniesRoute
  .route("/:id")
  .put(
    authService.protect,
    uploadInvestmentCompaniesImages,
    resizeInvestmentCompaniesImages,
    updateInvestmentCompanies
  )
  .get(getOneInvestmentCompanies)
  .delete(authService.protect, deleteInvestmentCompanies);

module.exports = investmentCompaniesRoute;
