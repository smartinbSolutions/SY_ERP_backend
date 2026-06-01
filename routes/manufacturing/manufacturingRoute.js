const express = require("express");
const {
  createBOM,
  getActiveBOM,
  produceProduct,
  getProductionLogs,
  deleteBOM,
  updateBOM,
  getAllBOMs,
  getAllProductionLogs,
} = require("../../services/manufacturing/manufacturingServices");

const authService = require("../../services/authService");

const manufacturingRoute = express.Router();

manufacturingRoute.use(authService.protect);

// BOM
manufacturingRoute
  .route("/bom")
  .post(authService.allowedTo("bom.create"), createBOM)
  .get(authService.allowedTo("bom.read"), getAllBOMs);

// Production
manufacturingRoute.post("/produce", authService.allowedTo("products.manufacture"), produceProduct);
manufacturingRoute.get("/logs", authService.allowedTo("products.manufacture"), getAllProductionLogs);
manufacturingRoute.get("/logs/:productId", authService.allowedTo("products.manufacture"), getProductionLogs);

manufacturingRoute
  .route("/bom/:productId")
  .get(authService.allowedTo("bom.read"), getActiveBOM)
  .put(authService.allowedTo("bom.update"), updateBOM)
  .delete(authService.allowedTo("bom.delete"), deleteBOM);

module.exports = manufacturingRoute;
