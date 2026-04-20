const express = require("express");
const authService = require("../../../services/authService");
const {
  createRefundSalesInvoice,
  findOneSalesRefund,
  findAllSalesRefunds,
} = require("../../../controllers/Accounting/Sales/SalesInvoice_Refund.controller");

const RefundSalesInvoices = express.Router();

RefundSalesInvoices.use(authService.protect);

RefundSalesInvoices.route("/")
  .post(authService.checkCompanyEditable, createRefundSalesInvoice)
  .get(findAllSalesRefunds);
RefundSalesInvoices.route("/:id").get(findOneSalesRefund);

module.exports = RefundSalesInvoices;
