const express = require("express");

const authService = require("../services/authService");
const {
  getAllShortage,
  createShortage,
} = require("../services/ShortageServices");

const ShortageRoute = express.Router();

ShortageRoute.use(authService.protect);

ShortageRoute.route("/")
  .get(getAllShortage)
  .post(authService.checkCompanyEditable, createShortage);

module.exports = ShortageRoute;
