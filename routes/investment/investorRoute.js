const express = require("express");
const {
  createInvestor,
  getAllInvestors,
  getOneInvestor,
  updateInvestor,
  deleteInvestor,
  resizeInvestorImages,
  uploadInvestorImages,
  uploadInvestorImagesDisk,
  processInvestorFiles,
} = require("../../services/investment/investorService");
const {
  investorLogin,
  investorRegister,
} = require("../../services/investment/investorAuthService");
const authService = require("../../services/authService");

const investorRoute = express.Router();

investorRoute
  .route("/")
  .post(
    authService.protect,
    uploadInvestorImages,
    resizeInvestorImages,
    createInvestor
  )
  .get(authService.protect, getAllInvestors);

investorRoute.route("/auth/login").post(investorLogin);
investorRoute.route("/auth/register").post(investorRegister);

investorRoute
  .route("/:id")
  .put(
    authService.protect,
    uploadInvestorImagesDisk,
    processInvestorFiles,
    updateInvestor
  )
  .get(authService.protect, getOneInvestor)
  .delete(authService.protect, deleteInvestor);

module.exports = investorRoute;
