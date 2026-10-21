const express = require("express");

const {
  createPosReceipt,
  findAllReceipt,
  findOneReceipt,
  cancelReceipt,
  findReceiptForDate,
  findAllReceiptForSalesPoint,
  mergeReceipts,
  convertReceiptsToSales,
} = require("../../controllers/Pos/Pos.Receipt.controller");
const authService = require("../../services/authService");
const loadCounterDigits = require("../../middlewares/loadCounterDigits");

const PosReceiptRoute = express.Router();

PosReceiptRoute.use(authService.protect, authService.checkPlanFeatures("pos"));

PosReceiptRoute.route("/")
  .get(
    // authService.allowedTo("sales.invoice.read"),
    findAllReceipt,
  )
  .post(
    // authService.allowedTo("sales.invoice.create"),
    authService.checkCompanyEditable,
    loadCounterDigits,
    createPosReceipt,
  );
PosReceiptRoute.route("/dailyreceipt/:id").get(
  // authService.allowedTo("sales.invoice.read"),
  findReceiptForDate,
);

PosReceiptRoute.route("/cancel_receipt/:id").put(
  // authService.allowedTo("sales.invoice.cancel"),
  authService.checkCompanyEditable,
  cancelReceipt,
);

PosReceiptRoute.route("/salespoint/:id").get(
  // authService.allowedTo("sales.invoice.read"),
  findAllReceiptForSalesPoint,
);

PosReceiptRoute.route("/convert/:id").post(
  // authService.allowedTo("sales.invoice.create"),
  authService.checkCompanyEditable,
  loadCounterDigits,
  convertReceiptsToSales,
);

PosReceiptRoute.route("/:id").get(
  // authService.allowedTo("sales.invoice.read"),
  findOneReceipt,
);
module.exports = PosReceiptRoute;
