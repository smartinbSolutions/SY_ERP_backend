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
  deleteCompanyBank,
  updateCompanyBank,
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
  .route("/:id/bank-qr/:bankQRId")
  .put(
    authService.protect,
    uploadInvestmentCompaniesImages,
    resizeInvestmentCompaniesImages,
    updateCompanyBank
  )
  .delete(authService.protect, deleteCompanyBank);

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
