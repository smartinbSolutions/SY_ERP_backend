const {
  createCurrency,
  getCurrency,
  getCurrencies,
  updateCurrency,
  deleteCurrency,
} = require("../../controllers/Settings/currency.controller");
const authService = require("../../services/authService");
const express = require("express");

const currencyRoute = express.Router();
currencyRoute.use(authService.protect);

currencyRoute
  .route("/")
  .get(getCurrencies)
  .post(authService.checkCompanyEditable, createCurrency);

currencyRoute
  .route("/:id")
  .get(getCurrency)
  .put(authService.checkCompanyEditable, updateCurrency)
  .delete(authService.checkCompanyEditable, deleteCurrency);

module.exports = currencyRoute;
