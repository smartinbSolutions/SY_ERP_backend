const express = require("express");

const authService = require("../services/authService");
const {
  getAllShortage,
  createShortage,
} = require("../services/ShortageServices");

const ShortageRoute = express.Router();

ShortageRoute.use(
  authService.checkPlanFeatures("inventory"),
  authService.protect,
);

ShortageRoute.route("/")
  .get(authService.allowedTo("stock.read"), getAllShortage)
  .post(
    authService.allowedTo("shortage.create"),
    authService.checkCompanyEditable,
    createShortage,
  );

module.exports = ShortageRoute;
