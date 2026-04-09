const express = require("express");
const authService = require("../../../services/authService");

const {
  findSupplier,
  uploadFile,
} = require("../../../services/purchaseInvoicesServices");

const {
  findOnePurchaseRefund,
  findAllPurchaseRefunds,
  findRefundablePurchaseItemsByInvoices,
} = require("../../../controllers/Accounting/Purchase/PurchaseInvoice_Refund.controller");

const RefundPurchaseInvoices = express.Router();

RefundPurchaseInvoices.use(authService.protect);
console.log("I am here");
/*
|--------------------------------------------------------------------------
| Helper / Lookup Routes
|--------------------------------------------------------------------------
*/
RefundPurchaseInvoices.post(
  "/items-by-invoices",
  findRefundablePurchaseItemsByInvoices
);

/*
|--------------------------------------------------------------------------
| Draft Action Routes
|--------------------------------------------------------------------------
*/
// PurchaseInvoices.route("/draft/:id")
//   .put(authService.checkCompanyEditable, uploadFile, updatePurchaseDraftInvoice)
//   .delete(authService.checkCompanyEditable, deletePurchaseInvoiceDraft);

// PurchaseInvoices.route("/post/:id").put(
//   authService.checkCompanyEditable,
//   postPurchaseInvoiceDraft
// );

/*
|--------------------------------------------------------------------------
| Posted Action Routes
|--------------------------------------------------------------------------
*/
// PurchaseInvoices.route("/cancel/:id").put(
//   authService.checkCompanyEditable,
//   cancelPurchaseInvoice
// );

// PurchaseInvoices.route("/update/:id").put(
//   authService.checkCompanyEditable,
//   uploadFile,
//   updatePostedPurchaseInvoice
// );

/*
|--------------------------------------------------------------------------
| Main Collection Routes
|--------------------------------------------------------------------------
*/
RefundPurchaseInvoices.route("/")
  //   .post(authService.checkCompanyEditable, uploadFile, createPurchaseInvoice)
  .get(findAllPurchaseRefunds);

/*
|--------------------------------------------------------------------------
| Single Invoice Routes
|--------------------------------------------------------------------------
*/
RefundPurchaseInvoices.route("/:id").get(findOnePurchaseRefund);

module.exports = RefundPurchaseInvoices;
