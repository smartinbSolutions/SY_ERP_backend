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
  .post(
    authService.allowedTo("sales.refund.create"),
    authService.checkCompanyEditable,
    createRefundSalesInvoice
  )
  .get(authService.allowedTo("sales.refund.read"), findAllSalesRefunds);
RefundSalesInvoices.route("/:id").get(
  authService.allowedTo("sales.refund.read"),
  findOneSalesRefund
);

module.exports = RefundSalesInvoices;
