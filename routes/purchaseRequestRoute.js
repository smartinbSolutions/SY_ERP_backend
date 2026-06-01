const express = require("express");
const {
  getAllPurchaseRequest,
  createCashPurchaseRequest,
  getPurchaseRequestById,
  updatePurchaseRequest,
  archivePurchaseRequest,
} = require("../services/purchaseRequestServices");
const authService = require("../services/authService");

const purchaseRequestRouter = express.Router();
purchaseRequestRouter.use(authService.protect);

// Create a new purchaseRequest / Get all purchaseRequests
purchaseRequestRouter
  .route("/")
  .post(
    authService.allowedTo("purchase.request.create"),
    authService.checkCompanyEditable,
    createCashPurchaseRequest
  )
  .get(authService.allowedTo("purchase.request.read"), getAllPurchaseRequest);

purchaseRequestRouter
  .route("/archive/:id")
  .put(
    authService.allowedTo("purchase.request.update"),
    authService.checkCompanyEditable,
    archivePurchaseRequest
  );
// Get / update / delete a specific purchaseRequest by ID
purchaseRequestRouter
  .route("/:id")
  .get(authService.allowedTo("purchase.request.read"), getPurchaseRequestById)
  .put(
    authService.allowedTo("purchase.request.update"),
    authService.checkCompanyEditable,
    updatePurchaseRequest
  );

module.exports = purchaseRequestRouter;
