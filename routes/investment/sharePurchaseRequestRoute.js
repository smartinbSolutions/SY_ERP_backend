const express = require("express");
const {
  getAllPurchaseRequest,
  createPurchaseRequest,
  getOnePurchaseRequest,
  deletePurchaseRequest,
  updatePurchaseRequest,
  getAllInvestorPurchaseRequest,
} = require("../../services/investment/sharePurchaseRequestService");

const sharePurchaseRequestRoute = express.Router();
sharePurchaseRequestRoute
  .route("/")
  .post(createPurchaseRequest)
  .get(getAllPurchaseRequest);

sharePurchaseRequestRoute
  .route("/investor/:id")
  .get(getAllInvestorPurchaseRequest);
sharePurchaseRequestRoute
  .route("/:id")
  .get(getOnePurchaseRequest)
  .delete(deletePurchaseRequest)
  .put(updatePurchaseRequest);

module.exports = sharePurchaseRequestRoute;
