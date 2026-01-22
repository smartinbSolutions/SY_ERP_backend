const express = require("express");
const authService = require("../services/authService");
const {
  createSalesPoint,
  getSalesPoint,
  getOneSalePoint,

  openAndCloseSalePoint,
  updateSalePoint,
} = require("../services/salesPointServices");

const SalesPointRout = express.Router();

SalesPointRout.use(authService.protect);

SalesPointRout.route("/")
  .get(getSalesPoint)
  .post(authService.checkCompanyEditable, createSalesPoint);
SalesPointRout.route("/:id")
  .get(getOneSalePoint)
  .put(authService.checkCompanyEditable, updateSalePoint);
SalesPointRout.route("/openandclose/:id").put(
  authService.checkCompanyEditable,
  openAndCloseSalePoint,
);

module.exports = SalesPointRout;
