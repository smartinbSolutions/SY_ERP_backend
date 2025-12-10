const express = require("express");

const authService = require("../services/authService");
const {
  getAllProductsMovements,
  getProductMovementByID,
  getHighestProductMovment,
  getSalesReports,
  getProductCostLedger,
} = require("../services/productMovementServices");

const productMovementsRoute = express.Router();

// productMovementsRoute.use(authService.protect);
productMovementsRoute.route("/").get(getAllProductsMovements);
productMovementsRoute.route("/highest-movenet").get(getHighestProductMovment);
productMovementsRoute.route("/salse_reports/:id").get(getSalesReports);
productMovementsRoute.route("/cost-ledger/:id").get(getProductCostLedger);
productMovementsRoute.route("/:id").get(getProductMovementByID);

module.exports = productMovementsRoute;
