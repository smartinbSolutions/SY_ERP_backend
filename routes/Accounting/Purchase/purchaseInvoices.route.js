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
  findSupplierPurchaseInvoicesForRefund
);

/*
|--------------------------------------------------------------------------
| Draft Action Routes
|--------------------------------------------------------------------------
*/
PurchaseInvoices.route("/draft/:id")
  .put(authService.checkCompanyEditable, uploadFile, updatePurchaseDraftInvoice)
  .delete(authService.checkCompanyEditable, deletePurchaseInvoiceDraft);

PurchaseInvoices.route("/post/:id").put(
  authService.checkCompanyEditable,
  postPurchaseInvoiceDraft
);

/*
|--------------------------------------------------------------------------
| Posted Action Routes
|--------------------------------------------------------------------------
*/
PurchaseInvoices.route("/cancel/:id").put(
  authService.checkCompanyEditable,
  cancelPurchaseInvoice
);

PurchaseInvoices.route("/update/:id").put(
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
  .post(authService.checkCompanyEditable, uploadFile, createPurchaseInvoice)
  .get(findAllPurchaseInvoices);

/*
|--------------------------------------------------------------------------
| Single Invoice Routes
|--------------------------------------------------------------------------
*/
PurchaseInvoices.route("/:id").get(findOnePurchaseInvoice);

module.exports = PurchaseInvoices;
