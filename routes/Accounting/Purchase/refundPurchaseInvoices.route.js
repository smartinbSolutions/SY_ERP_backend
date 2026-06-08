const express = require("express");
const authService = require("../../../services/authService");

const {
  uploadFile,
} = require("../../../services/Accounting/Purchase/PurchaseInvoice_Refund.service");

const {
  findOnePurchaseRefund,
  findAllPurchaseRefunds,
  findRefundablePurchaseItemsByInvoices,
  createRefundPurchaseInvoice,
} = require("../../../controllers/Accounting/Purchase/PurchaseInvoice_Refund.controller");

const RefundPurchaseInvoices = express.Router();

RefundPurchaseInvoices.use(
  authService.protect,
  authService.checkPlanFeatures("accounting"),
);
/*
|--------------------------------------------------------------------------
| Helper / Lookup Routes
|--------------------------------------------------------------------------
*/
RefundPurchaseInvoices.post(
  "/items-by-invoices",
  authService.allowedTo("purchase.refund.read"),
  findRefundablePurchaseItemsByInvoices,
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
    authService.allowedTo("purchase.refund.create"),
    authService.checkCompanyEditable,
    uploadFile,
    createRefundPurchaseInvoice,
  )
  .get(authService.allowedTo("purchase.refund.read"), findAllPurchaseRefunds);

/*
|--------------------------------------------------------------------------
| Single Invoice Routes
|--------------------------------------------------------------------------
*/
RefundPurchaseInvoices.route("/:id").get(
  authService.allowedTo("purchase.refund.read"),
  findOnePurchaseRefund,
);

module.exports = RefundPurchaseInvoices;
