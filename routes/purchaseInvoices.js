const express = require("express");
const authService = require("../services/authService");
const {
  findAllProductInvoices,
  findOneProductInvoices,
  refundPurchaseInvoice,
  getReturnPurchase,
  getOneReturnPurchase,
  // createPurchaseInvoice,
  // cancelPurchaseInvoice,
  // updatePurchaseInvoices,
  findSupplier,
  uploadFile,
  archivePurchaseInvoice,
  patchPurchaseInvoice,
} = require("../services/purchaseInvoicesServices");
const {
  createPurchaseInvoice,
  updatePurchaseInvoice,
  deletePurchaseInvoiceDraft,
  postPurchaseInvoiceDraft,
  cancelPurchaseInvoice,
} = require("../controllers/Accounting/Purchase/PurchaseInvoice.controller");

const PurchaseInvoices = express.Router();
PurchaseInvoices.use(authService.protect);

PurchaseInvoices.route("/refund")
  .get(getReturnPurchase)
  .post(authService.checkCompanyEditable, uploadFile, refundPurchaseInvoice);
PurchaseInvoices.route("/supplierinvoices/:id").get(findSupplier);

PurchaseInvoices.route("/refund/:id").get(getOneReturnPurchase);
PurchaseInvoices.route("/post/:id").put(postPurchaseInvoiceDraft);
PurchaseInvoices.route("/cancel/:id").put(cancelPurchaseInvoice);
PurchaseInvoices.route("/")
  .post(authService.checkCompanyEditable, uploadFile, createPurchaseInvoice)
  .get(findAllProductInvoices);
PurchaseInvoices.route("/archive/:id").put(
  authService.protect,
  archivePurchaseInvoice
);

PurchaseInvoices.route("/:id")
  .get(findOneProductInvoices)
  .put(authService.checkCompanyEditable, uploadFile, updatePurchaseInvoice)
  .delete(authService.checkCompanyEditable, deletePurchaseInvoiceDraft)
  .patch(authService.checkCompanyEditable, uploadFile, patchPurchaseInvoice);

module.exports = PurchaseInvoices;
