const express = require("express");

const {
  createPosReceipt,
  findAllReceipt,
  findOneReceipt,
  cancelReceipt,
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
PosReceiptRoute.route("/refund_pos_receipt")
  .get(findAllPosReceiptRefund)
  .post(authService.checkCompanyEditable, createPosReceiptRefund);
PosReceiptRoute.route("/refund_pos_receipt/:id").get(findOnePosReceiptRefund);
PosReceiptRoute.route("/:id").get(findOneReceipt);
PosReceiptRoute.route("/cancel_receipt/:id").put(
  authService.checkCompanyEditable,
  cancelReceipt,
);
module.exports = PosReceiptRoute;
