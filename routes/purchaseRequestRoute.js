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
  .post(createCashPurchaseRequest)
  .get(getAllPurchaseRequest);

purchaseRequestRouter.route("/archive/:id").put(archivePurchaseRequest);
// Get / update / delete a specific purchaseRequest by ID
purchaseRequestRouter
  .route("/:id")
  .get(getPurchaseRequestById)
  .put(updatePurchaseRequest);

module.exports = purchaseRequestRouter;
