const authService = require("../services/authService");
const {
  getCurrencyLog,
  getCurrencyRatesByDate,
} = require("../services/currencyLogService");
const express = require("express");

const currencyLogRoute = express.Router();

currencyLogRoute.use(authService.protect);
currencyLogRoute.route("/rates-by-date").get(getCurrencyRatesByDate);
currencyLogRoute.route("/:id").get(getCurrencyLog);

module.exports = currencyLogRoute;
