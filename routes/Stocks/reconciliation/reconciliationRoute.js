const express = require("express");
const {
  createStockReconciliation,
  upsertReconciliationItem,
  getAllReconciliations,
  getReconciliationById,
  getReconciliationItems,
  deleteReconciliationItem,
  getReconciliationItemsViewVersion,
  getOneItemForReconciliation,
  updataOneReconciliationReport, // paginated items
} = require("../../../services/Stocks/reconciliation/reconciliationServices");
const authService = require("../../../services/authService");

const reconciliationRoute = express.Router();

reconciliationRoute.use(authService.protect);

// Collection routes
reconciliationRoute
  .route("/")
  .post(authService.allowedTo("stock_reconciliation.update"), createStockReconciliation) // create new report
  .get(authService.allowedTo("stock_reconciliation.read"), getAllReconciliations); // get all reports with pagination

// Single reconciliation routes
reconciliationRoute
  .route("/:id")
  .get(authService.allowedTo("stock_reconciliation.read"), getReconciliationById)
  .delete(authService.allowedTo("stock_reconciliation.update"), deleteReconciliationItem);

// Reconciliation items
reconciliationRoute.route("/item").post(authService.allowedTo("stock_reconciliation.update"), upsertReconciliationItem); // upsert an item
reconciliationRoute.route("/item/list").get(authService.allowedTo("stock_reconciliation.read"), getReconciliationItems); // paginated items
reconciliationRoute
  .route("/item/list-view")
  .get(authService.allowedTo("stock_reconciliation.read"), getReconciliationItemsViewVersion); // paginated items

reconciliationRoute.route("/item/:id").get(authService.allowedTo("stock_reconciliation.read"), getOneItemForReconciliation);
reconciliationRoute.route("/reconcile/:id").put(authService.allowedTo("stock_reconciliation.update"), updataOneReconciliationReport);

module.exports = reconciliationRoute;
