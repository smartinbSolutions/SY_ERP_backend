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
manufacturingRoute.route("/bom").post(createBOM).get(getAllBOMs);

// Production
manufacturingRoute.post("/produce", produceProduct);
manufacturingRoute.get("/logs", getAllProductionLogs);
manufacturingRoute.get("/logs/:productId", getProductionLogs);

manufacturingRoute
  .route("/bom/:productId")
  .get(getActiveBOM)
  .put(updateBOM)
  .delete(deleteBOM);

module.exports = manufacturingRoute;
