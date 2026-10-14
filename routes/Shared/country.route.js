// routes/Shared/country.route.js
const express = require("express");
const authService = require("../../services/authService");
const {
  getCountries,
  getCountry,
} = require("../../controllers/Shared/country.controller");

const countryRoute = express.Router();
countryRoute.use(authService.protect);

countryRoute.route("/").get(getCountries);
countryRoute.route("/:id").get(getCountry);

module.exports = countryRoute;
