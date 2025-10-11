const express = require("express");

const authService = require("../services/authService");
const {
  getAllRawMatrialMovements,
  getRawMatrialMovementByID,
} = require("../services/rawMatrialMovementService");

const productMovementsRoute = express.Router();

productMovementsRoute.use(authService.protect);
productMovementsRoute.route("/").get(getAllRawMatrialMovements);
productMovementsRoute.route("/:id").get(getRawMatrialMovementByID);

module.exports = productMovementsRoute;
