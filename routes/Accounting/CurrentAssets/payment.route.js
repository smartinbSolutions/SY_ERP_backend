const express = require("express");

const authService = require("../../../services/authService");
const {
  createPayment,
  getOnePayment,
  getAllPayments,
} = require("../../../controllers/Accounting/CurrentAssets/Payments.controller");

const paymentRoute = express.Router();
paymentRoute.use(authService.protect);

paymentRoute
  .route("/")
  .get(authService.checkCompanyEditable, getAllPayments)
  .post(authService.checkCompanyEditable, createPayment);
paymentRoute.route("/:id").get(authService.checkCompanyEditable, getOnePayment);

module.exports = paymentRoute;
