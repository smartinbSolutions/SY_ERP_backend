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

const investorRoute = express.Router();

investorRoute
  .route("/")
  .post(uploadInvestorImages, resizeInvestorImages, createInvestor)
  .get(getAllInvestors);

investorRoute.route("/auth/login").post(investorLogin);
investorRoute.route("/auth/register").post(investorRegister);

investorRoute
  .route("/:id")
  .put(uploadInvestorImagesDisk, processInvestorFiles, updateInvestor)
  .get(getOneInvestor)
  .delete(deleteInvestor);

module.exports = investorRoute;
