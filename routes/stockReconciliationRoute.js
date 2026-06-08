const express = require("express");
const {
  createStockReconciliation,
  findAllReconciliations,
  findReconciliationReport,
  updataOneReconciliationReport,
  checkStockReconciliation,
} = require("../services/stockReconciliationServices");

const authService = require("../services/authService");

const StockReconciliationRoute = express.Router();

StockReconciliationRoute.use(
  authService.protect,
  authService.checkPlanFeatures("inventory"),
);

StockReconciliationRoute.route("/").get(
  authService.allowedTo("stock_reconciliation.read"),
  findAllReconciliations,
);
StockReconciliationRoute.route("/isreoprtclose/:stockid").get(
  authService.allowedTo("stock_reconciliation.read"),
  checkStockReconciliation,
);
StockReconciliationRoute.route("/:id").get(
  authService.allowedTo("stock_reconciliation.read"),
  findReconciliationReport,
);
StockReconciliationRoute.route("/reconcile").post(
  authService.allowedTo("stock_reconciliation.update"),
  authService.checkCompanyEditable,
  createStockReconciliation,
);
StockReconciliationRoute.route("/reconcile/:id").put(
  authService.allowedTo("stock_reconciliation.update"),
  authService.checkCompanyEditable,
  updataOneReconciliationReport,
);

module.exports = StockReconciliationRoute;
