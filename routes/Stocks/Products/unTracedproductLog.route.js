const express = require("express");

const authService = require("../../../services/authService");
const {
  getOneUnTracedproductLog,
  getUnTracedproductLog,
} = require("../../../controllers/Stocks/Products/unTracedproduct.controller");

const unTracedproductLogRoute = express.Router();

unTracedproductLogRoute.use(
  authService.protect,
  authService.checkPlanFeatures("inventory"),
);

unTracedproductLogRoute.route("/").get(getUnTracedproductLog);
unTracedproductLogRoute.route("/:id").get(getOneUnTracedproductLog);

module.exports = unTracedproductLogRoute;
