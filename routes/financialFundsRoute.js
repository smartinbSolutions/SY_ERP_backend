const express = require("express");
const {
  getFinancialFunds,
  createFinancialFunds,
  getOneFinancialFund,
  deletefinancialFund,
  transfer,
  getFinancialFundForSalesPoint,
  updateFinancialFund,
} = require("../services/financialFundsService");

const authService = require("../services/authService");
const financialFundsRoute = express.Router();

financialFundsRoute.use(authService.protect);

financialFundsRoute
  .route("/")
  .get(getFinancialFunds)
  .post(authService.checkCompanyEditable, createFinancialFunds);
financialFundsRoute
  .route("/:id")
  .get(getOneFinancialFund)
  .put(authService.checkCompanyEditable, updateFinancialFund)
  .delete(authService.checkCompanyEditable, deletefinancialFund);
financialFundsRoute.route("/pos/:id").get(getFinancialFundForSalesPoint);
financialFundsRoute
  .route("/trans/:id")
  .put(authService.checkCompanyEditable, transfer);

module.exports = financialFundsRoute;
