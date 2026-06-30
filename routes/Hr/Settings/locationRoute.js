const express = require("express");
const authService = require("../../../services/authService");
const {
  createLocations,
  deleteLocations,
  getAllLocations,
  getOneLocations,
  updateLocations,
} = require("../../../services/Hr/Settings/locationServices");

const locationRoute = express.Router();

locationRoute
  .route("/")
  .get(
    authService.protect,
    authService.allowedTo("hr.settings.read"),
    getAllLocations,
  )
  .post(
    authService.protect,
    authService.allowedTo("hr.settings.create"),
    createLocations,
  );

locationRoute
  .route("/:id")
  .get(
    authService.protect,
    authService.allowedTo("hr.settings.read"),
    getOneLocations,
  )
  .put(
    authService.protect,
    authService.allowedTo("hr.settings.update"),
    updateLocations,
  )
  .delete(
    authService.protect,
    authService.allowedTo("hr.settings.delete"),
    deleteLocations,
  );

module.exports = locationRoute;
