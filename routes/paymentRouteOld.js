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
paymentRoutOld
  .route("/")
  .get(getPayment)
  .post(authService.checkCompanyEditable, createPayment);
paymentRoutOld
  .route("/advance")
  .post(authService.checkCompanyEditable, createAdvancePayment);
paymentRoutOld
  .route("/:id")
  .get(getOnePayment)
  .delete(authService.checkCompanyEditable, deletePayment)
  .patch(authService.checkCompanyEditable, uploadFile, patchPayment);
paymentRoutOld
  .route("/transfer/:id")
  .delete(authService.checkCompanyEditable, deletePaymentTransferFund);
module.exports = paymentRoutOld;
