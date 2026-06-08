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

FundAndBank.use(
  authService.protect,
  authService.checkPlanFeatures("accounting"),
);

FundAndBank.route("/")
  .post(
    authService.allowedTo("funds.create"),
    authService.checkCompanyEditable,
    createFundAndBank,
  )
  .get(authService.allowedTo("funds.read"), findAllFundAndBank);

FundAndBank.route("/sales-point/:id").get(
  authService.allowedTo("funds.read"),
  authService.checkCompanyEditable,
  getFundAndBankForSalesPoint,
);

FundAndBank.route("/:id")
  .get(authService.allowedTo("funds.read"), findOneFundAndBank)
  .put(
    authService.allowedTo("funds.update"),
    authService.checkCompanyEditable,
    updateFundAndBank,
  )
  .delete(
    authService.allowedTo("funds.delete"),
    authService.checkCompanyEditable,
    deleteFundAndBank,
  );

FundAndBank.route("/reports/:id").get(
  authService.allowedTo("funds.read"),
  findSpecificFundReports,
);

FundAndBank.route("/:id/adjust").post(
  authService.allowedTo("funds.adjust"),
  authService.checkCompanyEditable,
  createFundAdjustment,
);

module.exports = FundAndBank;
