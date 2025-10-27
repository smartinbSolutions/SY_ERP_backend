const express = require("express");

const authService = require("../services/authService");
const {
  getPayment,
  createPayment,
  getOnePayment,
  deletePayment,
  deletePaymentTransferFund,
  createAdvancePayment,
  patchPayment,
  uploadFile,
} = require("../services/paymentServiceOld");

const paymentRoutOld = express.Router();
paymentRoutOld.use(authService.protect);
paymentRoutOld.route("/").get(getPayment).post(createPayment);
paymentRoutOld.route("/advance").post(createAdvancePayment);
paymentRoutOld
  .route("/:id")
  .get(getOnePayment)
  .delete(deletePayment)
  .patch(uploadFile, patchPayment);
paymentRoutOld.route("/transfer/:id").delete(deletePaymentTransferFund);
module.exports = paymentRoutOld;
