const express = require("express");
const authService = require("../../../services/authService");
const {
  createSalesInvoice,
  findAllSalesInvoices,
  findOneSalesInvoice,
  postSalesInvoiceDraft,
  deleteSalesInvoiceDraft,
  updateSalesDraftInvoice,
  cancelSalesInvoice,
  updatePostedSalesInvoice,
} = require("../../../controllers/Accounting/Sales/SalesInvoıce.controller");

const SalesInvoices = express.Router();

SalesInvoices.use(authService.protect);

SalesInvoices.route("/post/:id").put(
  authService.checkCompanyEditable,
  postSalesInvoiceDraft,
);
SalesInvoices.route("/draft/:id")
  .put(authService.checkCompanyEditable, updateSalesDraftInvoice)
  .delete(authService.checkCompanyEditable, deleteSalesInvoiceDraft);

SalesInvoices.route("/cancel/:id").put(
  authService.checkCompanyEditable,
  cancelSalesInvoice,
);

SalesInvoices.route("/update/:id").put(
  authService.checkCompanyEditable,
  updatePostedSalesInvoice,
);

SalesInvoices.route("/")
  .post(authService.checkCompanyEditable, createSalesInvoice)
  .get(findAllSalesInvoices);
SalesInvoices.route("/:id").get(findOneSalesInvoice);

module.exports = SalesInvoices;
