const express = require("express");
const authService = require("../../../services/authService");

const {
  uploadFile,
} = require("../../../services/Accounting/Purchase/PurchaseInvoice.service");

const {
  createPurchaseInvoice,
  deletePurchaseInvoiceDraft,
  postPurchaseInvoiceDraft,
  cancelPurchaseInvoice,
  updatePostedPurchaseInvoice,
  updatePurchaseDraftInvoice,
  findAllPurchaseInvoices,
  findOnePurchaseInvoice,
  findSupplierPurchaseInvoicesForRefund,
} = require("../../../controllers/Accounting/Purchase/PurchaseInvoice.controller");

const PurchaseInvoices = express.Router();

PurchaseInvoices.use(authService.protect);

/*
|--------------------------------------------------------------------------
| Helper / Lookup Routes
|--------------------------------------------------------------------------
*/
PurchaseInvoices.route("/supplier/:supplierId").get(
  authService.allowedTo("purchase.invoice.read"),
  findSupplierPurchaseInvoicesForRefund
);

/*
|--------------------------------------------------------------------------
| Draft Action Routes
|--------------------------------------------------------------------------
*/
PurchaseInvoices.route("/draft/:id")
  .put(
    authService.allowedTo("purchase.invoice.update.draft"),
    authService.checkCompanyEditable,
    uploadFile,
    updatePurchaseDraftInvoice
  )
  .delete(
    authService.allowedTo("purchase.invoice.delete.draft"),
    authService.checkCompanyEditable,
    deletePurchaseInvoiceDraft
  );

PurchaseInvoices.route("/post/:id").put(
  authService.allowedTo("purchase.invoice.post"),
  authService.checkCompanyEditable,
  postPurchaseInvoiceDraft
);

/*
|--------------------------------------------------------------------------
| Posted Action Routes
|--------------------------------------------------------------------------
*/
PurchaseInvoices.route("/cancel/:id").put(
  authService.allowedTo("purchase.invoice.cancel"),
  authService.checkCompanyEditable,
  cancelPurchaseInvoice
);

PurchaseInvoices.route("/update/:id").put(
  authService.allowedTo("purchase.invoice.update.posted"),
  authService.checkCompanyEditable,
  uploadFile,
  updatePostedPurchaseInvoice
);

/*
|--------------------------------------------------------------------------
| Main Collection Routes
|--------------------------------------------------------------------------
*/
PurchaseInvoices.route("/")
  .post(
    authService.allowedTo("purchase.invoice.create"),
    authService.checkCompanyEditable,
    uploadFile,
    createPurchaseInvoice
  )
  .get(authService.allowedTo("purchase.invoice.read"), findAllPurchaseInvoices);

/*
|--------------------------------------------------------------------------
| Single Invoice Routes
|--------------------------------------------------------------------------
*/
PurchaseInvoices.route("/:id").get(
  authService.allowedTo("purchase.invoice.read"),
  findOnePurchaseInvoice
);

module.exports = PurchaseInvoices;
