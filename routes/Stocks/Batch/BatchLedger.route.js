const express = require("express");
const authService = require("../../../services/authService");
const {
  findAllBatchLedgerForProduct,
} = require("../../../controllers/Stocks/Batch/BatchLedger.controller");

const BatchLedger = express.Router();

BatchLedger.use(
  authService.protect,
  authService.checkPlanFeatures("inventory")
);

BatchLedger.route("/:id").get(findAllBatchLedgerForProduct);

module.exports = BatchLedger;
