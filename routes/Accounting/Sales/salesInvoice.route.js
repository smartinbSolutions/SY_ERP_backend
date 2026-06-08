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
  findCustomerSalesInvoices,
} = require("../../../controllers/Accounting/Sales/SalesInvoice.controller");

const SalesInvoices = express.Router();

SalesInvoices.use(
  authService.checkPlanFeatures("accounting"),
  authService.protect,
);

SalesInvoices.route("/post/:id").put(
  authService.allowedTo("sales.invoice.post"),
  authService.checkCompanyEditable,
  postSalesInvoiceDraft,
);
SalesInvoices.route("/draft/:id")
  .put(
    authService.allowedTo("sales.invoice.update.draft"),
    authService.checkCompanyEditable,
    updateSalesDraftInvoice,
  )
  .delete(
    authService.allowedTo("sales.invoice.delete.draft"),
    authService.checkCompanyEditable,
    deleteSalesInvoiceDraft,
  );

SalesInvoices.route("/cancel/:id").put(
  authService.allowedTo("sales.invoice.cancel"),
  authService.checkCompanyEditable,
  cancelSalesInvoice,
);

SalesInvoices.route("/update/:id").put(
  authService.allowedTo("sales.invoice.update.posted"),
  authService.checkCompanyEditable,
  updatePostedSalesInvoice,
);
SalesInvoices.route("/customerorder/:id").get(
  authService.allowedTo("sales.invoice.read"),
  authService.checkCompanyEditable,
  findCustomerSalesInvoices,
);
SalesInvoices.route("/")
  .post(
    authService.allowedTo("sales.invoice.create"),
    authService.checkCompanyEditable,
    createSalesInvoice,
  )
  .get(authService.allowedTo("sales.invoice.read"), findAllSalesInvoices);
SalesInvoices.route("/:id").get(
  authService.allowedTo("sales.invoice.read"),
  findOneSalesInvoice,
);

module.exports = SalesInvoices;
