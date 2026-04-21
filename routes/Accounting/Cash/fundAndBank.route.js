const express = require("express");
const authService = require("../../../services/authService");
const {
  findAllFundAndBank,
  findOneFundAndBank,
  createFundAndBank,
  deleteFundAndBank,
  updateFundAndBank,
  cashTransfer,
  getFundAndBankForSalesPoint,
} = require("../../../controllers/Accounting/Cash/FundAndBank.controller");

const FundAndBank = express.Router();

FundAndBank.use(authService.protect);

FundAndBank.route("/")
  .post(authService.checkCompanyEditable, createFundAndBank)
  .get(findAllFundAndBank);

FundAndBank.route("/trans/:id").put(
  authService.checkCompanyEditable,
  cashTransfer,
);
FundAndBank.route("/sales-point/:id").get(
  authService.checkCompanyEditable,
  getFundAndBankForSalesPoint,
);

FundAndBank.route("/:id")
  .get(findOneFundAndBank)
  .put(authService.checkCompanyEditable, updateFundAndBank)
  .delete(authService.checkCompanyEditable, deleteFundAndBank);

module.exports = FundAndBank;
