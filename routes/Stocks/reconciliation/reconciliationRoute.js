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
  .post(createStockReconciliation) // create new report
  .get(getAllReconciliations); // get all reports with pagination

// Single reconciliation routes
reconciliationRoute
  .route("/:id")
  .get(getReconciliationById)
  .delete(deleteReconciliationItem);

// Reconciliation items
reconciliationRoute.route("/item").post(upsertReconciliationItem); // upsert an item
reconciliationRoute.route("/item/list").get(getReconciliationItems); // paginated items
reconciliationRoute
  .route("/item/list-view")
  .get(getReconciliationItemsViewVersion); // paginated items

reconciliationRoute.route("/item/:id").get(getOneItemForReconciliation);
reconciliationRoute.route("/reconcile/:id").put(updataOneReconciliationReport);

module.exports = reconciliationRoute;
