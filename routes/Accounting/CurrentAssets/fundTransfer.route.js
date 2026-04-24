const express = require("express");
const authService = require("../../../services/authService");
const {
  createFundTransfer,
  getAllFundTransfers,
  getOneFundTransfer,
  cancelFundTransfer,
} = require("../../../controllers/Accounting/CurrentAssets/FundTransfer.controller");

const FundTransfer = express.Router();

FundTransfer.use(authService.protect);

FundTransfer.route("/")
  .post(authService.checkCompanyEditable, createFundTransfer)
  .get(getAllFundTransfers);

FundTransfer.route("/:id").get(getOneFundTransfer);

FundTransfer.route("/:id/cancel").put(
  authService.checkCompanyEditable,
  cancelFundTransfer
);

module.exports = FundTransfer;
