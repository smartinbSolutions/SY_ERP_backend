const authService = require("../services/authService");
const { getCurrencyLog } = require("../services/currencyLogService");
const express = require("express");

const currencyLogRoute = express.Router();

currencyLogRoute.use(authService.protect);

currencyLogRoute.route("/:id").get(getCurrencyLog);

module.exports = currencyLogRoute;
