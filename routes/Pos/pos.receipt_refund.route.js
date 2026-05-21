const express = require("express");

const authService = require("../../services/authService");
const {
  createPosReceiptRefund,
  findAllPosReceiptRefund,
  findOnePosReceiptRefund,
  findRefundReceiptForDate,
} = require("../../controllers/Pos/Pos.Receipt_Refund.controller");
const {
  findRefundReceiptForDateService,
} = require("../../services/Pos/Pos.Receipt_refund.service");

const PosReceiptRefundRoute = express.Router();

PosReceiptRefundRoute.use(authService.protect);

PosReceiptRefundRoute.route("/")
  .get(findAllPosReceiptRefund)
  .post(authService.checkCompanyEditable, createPosReceiptRefund);
PosReceiptRefundRoute.route("/daily_refund_receipt/:id").get(
  findRefundReceiptForDate,
);

PosReceiptRefundRoute.route("/:id").get(findOnePosReceiptRefund);

module.exports = PosReceiptRefundRoute;
