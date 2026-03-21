const express = require("express");
const authService = require("../services/authService");

const {
  findAllProductInvoices,
  findOneProductInvoices,
  findSupplier,
  uploadFile,
  patchPurchaseInvoice,
} = require("../services/purchaseInvoicesServices");

const {
  createPurchaseInvoice,
  updatePurchaseInvoice,
  deletePurchaseInvoiceDraft,
  postPurchaseInvoiceDraft,
  cancelPurchaseInvoice,
  updatePostedPurchaseInvoice,
  updatePurchaseDraftInvoice,
} = require("../controllers/Accounting/Purchase/PurchaseInvoice.controller");

const PurchaseInvoices = express.Router();

PurchaseInvoices.use(authService.protect);

/*
|--------------------------------------------------------------------------
| Helper / Lookup Routes
|--------------------------------------------------------------------------
*/
PurchaseInvoices.route("/supplierinvoices/:id").get(findSupplier);

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
  .get(findAllProductInvoices);

/*
|--------------------------------------------------------------------------
| Single Invoice Routes
|--------------------------------------------------------------------------
*/
PurchaseInvoices.route("/:id").get(findOneProductInvoices);

module.exports = PurchaseInvoices;
