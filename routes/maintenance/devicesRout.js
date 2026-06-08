const express = require("express");

const authService = require("../../services/authService");
const {
  getOneDevice,
  createDevice,
  getDevices,
  updateDevices,
  deleteDevice,
  importDevice,
} = require("../../services/maintenance/devicesService");
const multer = require("multer");
const upload = multer();

const devicesRout = express.Router();

devicesRout.use(
  authService.protect,
  authService.checkPlanFeatures("maintenance"),
);

devicesRout
  .route("/")
  .get(authService.allowedTo("maintenance.devices.read"), getDevices)
  .post(
    authService.allowedTo("maintenance.devices.create"),
    authService.checkCompanyEditable,
    createDevice,
  );
devicesRout
  .route("/test")
  .post(
    authService.allowedTo("maintenance.devices.create"),
    authService.checkCompanyEditable,
    upload.single("file"),
    importDevice,
  );

devicesRout
  .route("/:id")
  .get(authService.allowedTo("maintenance.devices.read"), getOneDevice)
  .put(
    authService.allowedTo("maintenance.devices.update"),
    authService.checkCompanyEditable,
    updateDevices,
  )
  .delete(authService.allowedTo("maintenance.devices.update"), deleteDevice);

module.exports = devicesRout;
