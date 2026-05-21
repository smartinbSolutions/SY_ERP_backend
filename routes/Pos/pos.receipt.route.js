const express = require("express");

const {
  createPosReceipt,
  findAllReceipt,
  findOneReceipt,
  cancelReceipt,
  findReceiptForDate,
} = require("../../controllers/Pos/Pos.Receipt.controller");
const authService = require("../../services/authService");
const {
  createPosReceiptRefund,
  findAllPosReceiptRefund,
  findOnePosReceiptRefund,
} = require("../../controllers/Pos/Pos.Receipt_Refund.controller");

const PosReceiptRoute = express.Router();

PosReceiptRoute.use(authService.protect);

PosReceiptRoute.route("/")
  .get(findAllReceipt)
  .post(authService.checkCompanyEditable, createPosReceipt);
PosReceiptRoute.route("/dailyreceipt/:id").get(findReceiptForDate);

PosReceiptRoute.route("/cancel_receipt/:id").put(
  authService.checkCompanyEditable,
  cancelReceipt,
);
PosReceiptRoute.route("/:id").get(findOneReceipt);
module.exports = PosReceiptRoute;
