const express = require("express");

const authService = require("../services/authService");
const {
  getInvoiceById,
  createInvoiceHistory,
} = require("../services/invoiceHistoryService");

const invoiceHistoryRoute = express.Router();

invoiceHistoryRoute.use(
  authService.protect,
  authService.checkPlanFeatures("accounting"),
);
invoiceHistoryRoute.route("/:id").get(getInvoiceById);
invoiceHistoryRoute
  .route("/")
  .post(authService.checkCompanyEditable, createInvoiceHistory);

module.exports = invoiceHistoryRoute;
