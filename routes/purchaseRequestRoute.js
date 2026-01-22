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
  .post(authService.checkCompanyEditable, createCashPurchaseRequest)
  .get(getAllPurchaseRequest);

purchaseRequestRouter
  .route("/archive/:id")
  .put(authService.checkCompanyEditable, archivePurchaseRequest);
// Get / update / delete a specific purchaseRequest by ID
purchaseRequestRouter
  .route("/:id")
  .get(getPurchaseRequestById)
  .put(authService.checkCompanyEditable, updatePurchaseRequest);

module.exports = purchaseRequestRouter;
