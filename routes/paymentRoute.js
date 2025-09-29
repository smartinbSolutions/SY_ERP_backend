const express = require("express");

const authService = require("../services/authService");
const {
  getPayment,
  createPayment,
  getOnePayment,
  deletePayment,
  deletePaymentTransferFund,
  createAdvancePayment,
} = require("../services/paymentService");

const paymentRout = express.Router();
paymentRout.use(authService.protect);
paymentRout.route("/").get(getPayment).post(createPayment);
paymentRout.route("/advance").post(createAdvancePayment);
paymentRout.route("/:id").get(getOnePayment).delete(deletePayment);
paymentRout.route("/transfer/:id").delete(deletePaymentTransferFund);
module.exports = paymentRout;
