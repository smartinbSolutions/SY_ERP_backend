const express = require("express");
const authService = require("../../../services/authService");
const {
  findAllFundAndBank,
  findOneFundAndBank,
  createFundAndBank,
  deleteFundAndBank,
  updateFundAndBank,
  getFundAndBankForSalesPoint,
  findSpecificFundReports,
  createFundAdjustment,
} = require("../../../controllers/Accounting/CurrentAssets/FundAndBank.controller");

const FundAndBank = express.Router();

FundAndBank.use(authService.protect);

FundAndBank.route("/")
  .post(authService.checkCompanyEditable, createFundAndBank)
  .get(findAllFundAndBank);

FundAndBank.route("/sales-point/:id").get(
  authService.checkCompanyEditable,
  getFundAndBankForSalesPoint
);

FundAndBank.route("/:id")
  .get(findOneFundAndBank)
  .put(authService.checkCompanyEditable, updateFundAndBank)
  .delete(authService.checkCompanyEditable, deleteFundAndBank);

FundAndBank.route("/reports/:id").get(findSpecificFundReports);

FundAndBank.route("/:id/adjust").post(createFundAdjustment);

module.exports = FundAndBank;
