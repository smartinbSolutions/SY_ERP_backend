const express = require("express");
const {
  createPayment,
  getPayment,
  deletePayment,
  getOnePayment,
} = require("../services/paymentService");
const authService = require("../services/authService");

const paymentRoute = express.Router();
paymentRoute.use(authService.protect);

paymentRoute
  .route("/")
  .post(authService.checkCompanyEditable, createPayment)
  .get(getPayment);
paymentRoute
  .route("/:id")
  .delete(authService.checkCompanyEditable, deletePayment)
  .get(getOnePayment);

module.exports = paymentRoute;
