const express = require("express");
const {
  getCurrencies,
  createCurrency,
  getCurrency,
  deleteCurrency,
  updateCurrency,
} = require("../services/Settings/currency.service");

const authService = require("../services/authService");

const currencyRoute = express.Router();

currencyRoute
  .route("/")
  .get(getCurrencies)
  .post(authService.protect, authService.checkCompanyEditable, createCurrency);
currencyRoute
  .route("/:id")
  .get(getCurrency)
  .put(authService.protect, authService.checkCompanyEditable, updataCurrency)
  .delete(authService.protect, deleteCurrency);

module.exports = currencyRoute;
