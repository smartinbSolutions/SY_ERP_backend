const express = require("express");

const authService = require("../../../services/authService");
const {
  createPayment,
  getOnePayment,
  getAllPayments,
  cancelPayment,
} = require("../../../controllers/Accounting/CurrentAssets/Payments.controller");
const loadCounterDigits = require("../../../middlewares/loadCounterDigits");

const paymentRoute = express.Router();
paymentRoute.use(
  authService.protect,
  authService.checkPlanFeatures("accounting"),
);

paymentRoute
  .route("/")
  .get(authService.allowedTo("payments.read"), getAllPayments)
  .post(
    authService.allowedTo("payments.create"),
    authService.checkCompanyEditable,
    loadCounterDigits,
    createPayment,
  );
paymentRoute
  .route("/:id")
  .get(authService.allowedTo("payments.read"), getOnePayment);
paymentRoute
  .route("/cancel/:id")
  .post(
    authService.allowedTo("payments.create"),
    authService.checkCompanyEditable,
    loadCounterDigits,
    cancelPayment,
  );

module.exports = paymentRoute;
