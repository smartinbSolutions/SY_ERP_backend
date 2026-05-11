const express = require("express");

const authService = require("../../../services/authService");
const {
  createPayment,
  getOnePayment,
  getAllPayments,
  cancelPayment,
} = require("../../../controllers/Accounting/CurrentAssets/Payments.controller");

const paymentRoute = express.Router();
paymentRoute.use(authService.protect);

paymentRoute
  .route("/")
  .get(getAllPayments)
  .post(authService.checkCompanyEditable, createPayment);
paymentRoute.route("/:id").get(getOnePayment);
paymentRoute
  .route("/cancel/:id")
  .post(authService.checkCompanyEditable, cancelPayment);

module.exports = paymentRoute;
