const express = require("express");

const authService = require("../services/authService");
const {
  getAllProductsMovements,
  getProductMovementByID,
  getHighestProductMovment,
  getSalesReports,
  getProductCostLedger,
  getProductMovementReport,
} = require("../services/productMovementServices");

const productMovementsRoute = express.Router();

productMovementsRoute.use(
  authService.protect,
  authService.checkPlanFeatures("inventory"),
);
productMovementsRoute
  .route("/")
  .get(authService.allowedTo("stock.movements.read"), getAllProductsMovements);
productMovementsRoute
  .route("/highest-movenet")
  .get(authService.allowedTo("stock.movements.read"), getHighestProductMovment);
productMovementsRoute
  .route("/salse_reports/:id")
  .get(authService.allowedTo("reports_products.read"), getSalesReports);
productMovementsRoute
  .route("/cost-ledger/:id")
  .get(authService.allowedTo("stock.movements.read"), getProductCostLedger);
productMovementsRoute
  .route("/product-reports")
  .get(
    authService.allowedTo("reports_products.read"),
    getProductMovementReport,
  );
productMovementsRoute
  .route("/:id")
  .get(authService.allowedTo("stock.movements.read"), getProductMovementByID);

module.exports = productMovementsRoute;
