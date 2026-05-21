const express = require("express");

const authService = require("../../services/authService");
const {
  createPosReceiptRefund,
  findAllPosReceiptRefund,
  findOnePosReceiptRefund,
} = require("../../controllers/Pos/Pos.Receipt_Refund.controller");

const PosReceiptRefundRoute = express.Router();

PosReceiptRefundRoute.use(authService.protect);

PosReceiptRefundRoute.route("/")
  .get(findAllPosReceiptRefund)
  .post(authService.checkCompanyEditable, createPosReceiptRefund);
PosReceiptRefundRoute.route("/:id").get(findOnePosReceiptRefund);

module.exports = PosReceiptRefundRoute;
