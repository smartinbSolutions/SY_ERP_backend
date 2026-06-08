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

PosReceiptRefundRoute.use(
  authService.checkPlanFeatures("pos"),
  authService.protect,
);

PosReceiptRefundRoute.route("/")
  .get(
    authService.allowedTo("pos.receipts.refund.read"),
    findAllPosReceiptRefund,
  )
  .post(
    authService.allowedTo("sales.refund.create"),
    authService.checkCompanyEditable,
    createPosReceiptRefund,
  );
PosReceiptRefundRoute.route("/daily_refund_receipt/:id").get(
  authService.allowedTo("pos.receipts.refund.read"),
  findRefundReceiptForDate,
);

PosReceiptRefundRoute.route("/:id").get(
  authService.allowedTo("pos.receipts.refund.read"),
  findOnePosReceiptRefund,
);

module.exports = PosReceiptRefundRoute;
