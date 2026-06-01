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
  .get(authService.allowedTo("payments.read"), getAllPayments)
  .post(
    authService.allowedTo("payments.create"),
    authService.checkCompanyEditable,
    createPayment
  );
paymentRoute.route("/:id").get(authService.allowedTo("payments.read"), getOnePayment);
paymentRoute
  .route("/cancel/:id")
  .post(
    authService.allowedTo("payments.create"),
    authService.checkCompanyEditable,
    cancelPayment
  );

module.exports = paymentRoute;
