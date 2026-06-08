const express = require("express");
const authService = require("../../../services/authService");
const {
  createFundTransfer,
  getAllFundTransfers,
  getOneFundTransfer,
  cancelFundTransfer,
} = require("../../../controllers/Accounting/CurrentAssets/FundTransfer.controller");

const FundTransfer = express.Router();

FundTransfer.use(
  authService.protect,
  authService.checkPlanFeatures("accounting"),
);

FundTransfer.route("/")
  .post(
    authService.allowedTo("funds.transfer"),
    authService.checkCompanyEditable,
    createFundTransfer,
  )
  .get(authService.allowedTo("funds.read"), getAllFundTransfers);

FundTransfer.route("/:id").get(
  authService.allowedTo("funds.read"),
  getOneFundTransfer,
);

FundTransfer.route("/:id/cancel").put(
  authService.allowedTo("funds.transfer"),
  authService.checkCompanyEditable,
  cancelFundTransfer,
);

module.exports = FundTransfer;
