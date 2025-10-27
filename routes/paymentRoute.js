const express = require("express");
const { createPayment } = require("../services/paymentService");
const authService = require("../services/authService");

const paymentRoute = express.Router();
paymentRoute.use(authService.protect);

paymentRoute.route("/").post(createPayment);

module.exports = paymentRoute;
