const express = require("express");

const authService = require("../../services/authService");
const {
  getManitenaceUser,
  updateManitenaceUser,
  getOneManitenaceUser,
  createManitenaceUser,
  deleteManitenaceUser,
  importClint,
} = require("../../services/maintenance/maintenanceUserService");
const { getDevicesByUserID } = require("../../services/maintenance/devicesService");

const manitUserRout = express.Router();
const multer = require("multer");
const upload = multer();
manitUserRout.use(authService.protect);

manitUserRout
  .route("/")
  .get(authService.allowedTo("maintenance.clients.read"), getManitenaceUser)
  .post(
    authService.allowedTo("maintenance.clients.create"),
    authService.checkCompanyEditable,
    createManitenaceUser,
  );
manitUserRout.route("/devices/:id").get(
  authService.allowedTo("maintenance.devices.read"),
  getDevicesByUserID,
);
manitUserRout.route("/test").post(
  authService.allowedTo("maintenance.clients.create"),
  authService.checkCompanyEditable,
  upload.single("file"),
  importClint,
);

manitUserRout
  .route("/:id")
  .get(authService.allowedTo("maintenance.clients.read"), getOneManitenaceUser)
  .put(
    authService.allowedTo("maintenance.clients.update"),
    authService.checkCompanyEditable,
    updateManitenaceUser,
  )
  .delete(
    authService.allowedTo("maintenance.clients.update"),
    authService.checkCompanyEditable,
    deleteManitenaceUser,
  );

module.exports = manitUserRout;
