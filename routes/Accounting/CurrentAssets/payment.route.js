const express = require("express");

const authService = require("../../../services/authService");
const {
  createPayment,
  getOnePayment,
} = require("../../../controllers/Accounting/CurrentAssets/Payments.controller");

const paymentRoute = express.Router();
paymentRoute.use(authService.protect);

paymentRoute.route("/").post(authService.checkCompanyEditable, createPayment);
paymentRoute
  .route("/:id")
  .post(authService.checkCompanyEditable, getOnePayment);

module.exports = paymentRoute;
