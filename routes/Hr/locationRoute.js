const express = require("express");
const authService = require("../../services/authService");
const {
  createLocations,
  deleteLocations,
  getAllLocations,
  getOneLocations,
  updateLocations,
} = require("../../services/Hr/locationServices");

const locationRoute = express.Router();

locationRoute.route("/").get(getAllLocations).post(createLocations);

locationRoute
  .route("/:id")
  .get(getOneLocations)
  .put(updateLocations)
  .delete(deleteLocations);

module.exports = locationRoute;
