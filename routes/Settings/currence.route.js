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
  .get(authService.allowedTo("currencies.read"), getCurrencies)
  .post(
    authService.allowedTo("currencies.create"),
    authService.checkCompanyEditable,
    createCurrency
  );

currencyRoute
  .route("/:id")
  .get(authService.allowedTo("currencies.read"), getCurrency)
  .put(
    authService.allowedTo("currencies.update"),
    authService.checkCompanyEditable,
    updateCurrency
  )
  .delete(
    authService.allowedTo("currencies.delete"),
    authService.checkCompanyEditable,
    deleteCurrency
  );

module.exports = currencyRoute;
