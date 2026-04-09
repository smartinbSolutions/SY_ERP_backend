const express = require("express");
const authService = require("../../../services/authService");

const { uploadFile } = require("../../../services/purchaseInvoicesServices");

const {
  findOnePurchaseRefund,
  findAllPurchaseRefunds,
  findRefundablePurchaseItemsByInvoices,
  createRefundPurchaseInvoice,
} = require("../../../controllers/Accounting/Purchase/PurchaseInvoice_Refund.controller");

const RefundPurchaseInvoices = express.Router();

RefundPurchaseInvoices.use(authService.protect);
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
  .post(
    authService.checkCompanyEditable,
    uploadFile,
    createRefundPurchaseInvoice
  )
  .get(findAllPurchaseRefunds);

/*
|--------------------------------------------------------------------------
| Single Invoice Routes
|--------------------------------------------------------------------------
*/
RefundPurchaseInvoices.route("/:id").get(findOnePurchaseRefund);

module.exports = RefundPurchaseInvoices;
