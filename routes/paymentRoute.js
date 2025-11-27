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

paymentRoute.route("/").post(createPayment).get(getPayment);
paymentRoute.route("/:id").delete(deletePayment).get(getOnePayment);

module.exports = paymentRoute;
