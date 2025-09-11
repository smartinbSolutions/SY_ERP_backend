const express = require("express");
const authService = require("../../services/authService");
const {
  createEFatura,
  getEFaturaStatus,
  updateEfaturaStatus,
  getAllIncomingEFatura,
  getEFaturaCustom,
  replyCommercialEfatura,
} = require("../../services/efatura/efaturaServices");

const efaturaRoute = express.Router();

efaturaRoute.route("/:type").post(authService.protect, createEFatura);
efaturaRoute.route("/getStatus/:id").get(authService.protect, getEFaturaStatus);
efaturaRoute
  .route("/updateStatus")
  .put(authService.protect, updateEfaturaStatus);
efaturaRoute
  .route("/getAllIncoming")
  .get(authService.protect, getAllIncomingEFatura);
efaturaRoute
  .route("/getEfaturaCustom/:id/:type")
  .get(authService.protect, getEFaturaCustom);
efaturaRoute
  .route("/replyEfatura")
  .post(authService.protect, replyCommercialEfatura);

module.exports = efaturaRoute;
