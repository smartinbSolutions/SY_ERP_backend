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

SalesPointRout.use(authService.checkPlanFeatures("pos"), authService.protect);

SalesPointRout.route("/")
  .get(authService.allowedTo("pos.point.read"), getSalesPoint)
  .post(
    authService.allowedTo("pos.point.create"),
    authService.checkCompanyEditable,
    createSalesPoint,
  );
SalesPointRout.route("/:id")
  .get(authService.allowedTo("pos.point.read"), getOneSalePoint)
  .put(
    authService.allowedTo("pos.point.update"),
    authService.checkCompanyEditable,
    updateSalePoint,
  );
SalesPointRout.route("/openandclose/:id").put(
  authService.allowedTo("pos.point.update"),
  authService.checkCompanyEditable,
  openAndCloseSalePoint,
);

module.exports = SalesPointRout;
