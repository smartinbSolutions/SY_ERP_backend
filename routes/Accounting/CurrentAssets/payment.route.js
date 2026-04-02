const express = require("express");

const authService = require("../../../services/authService");
const {
  createPayment,
} = require("../../../controllers/Accounting/CurrentAssets/Payments.controller");

const paymentRoute = express.Router();
paymentRoute.use(authService.protect);

paymentRoute.route("/").post(authService.checkCompanyEditable, createPayment);

module.exports = paymentRoute;
