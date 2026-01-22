const express = require("express");
const {
  getPaymentTypes,
  createPaymentType,
  getOnePaymentType,
  updataPaymentType,
  deleteOnePaymentType,
} = require("../services/paymentTypesService");
const authService = require("../services/authService");

const paymentTypes = express.Router();

paymentTypes.use(authService.protect);

paymentTypes
  .route("/")
  .get(getPaymentTypes)
  .post(authService.checkCompanyEditable, createPaymentType);
paymentTypes
  .route("/:id")
  .get(getOnePaymentType)
  .put(authService.checkCompanyEditable, updataPaymentType)
  .delete(authService.checkCompanyEditable, deleteOnePaymentType);

module.exports = paymentTypes;
