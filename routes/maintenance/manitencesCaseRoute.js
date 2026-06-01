const express = require("express");

const authService = require("../../services/authService");
const {
  getManitenaceCase,
  createManitenaceCase,
  getOneManitenaceCase,
  updateManitenaceCase,
  deleteManitenaceCase,
  convertToSales,
  addProductInManitencesCase,
  getCaseByDeviceId,
  addCalling,
  getOneManitenaceCaseForUser,
} = require("../../services/maintenance/manitencesCaseService");

const manitCaseRout = express.Router();

manitCaseRout
  .route("/maintenancecase/:counter")
  .get(getOneManitenaceCaseForUser)
manitCaseRout
  .route("/")
  .get(authService.protect, authService.allowedTo("maintenance.case.read"), getManitenaceCase)
  .post(
    authService.protect,
    authService.allowedTo("maintenance.case.create"),
    authService.checkCompanyEditable,
    createManitenaceCase,
  );
manitCaseRout.route("/addproduct/:id").put(
  authService.protect,
  authService.allowedTo("maintenance.case.update"),
  authService.checkCompanyEditable,
  addProductInManitencesCase,
);
manitCaseRout.route("/addcalling/:id").put(
  authService.protect,
  authService.allowedTo("maintenance.case.add_connection"),
  authService.checkCompanyEditable,
  addCalling,
);
manitCaseRout.route("/convert/:id").put(
  authService.protect,
  authService.allowedTo("maintenance.case.convert_to_invoice"),
  authService.checkCompanyEditable,
  convertToSales,
);
manitCaseRout.route("/devicecases/:id").get(
  authService.protect,
  authService.allowedTo("maintenance.case.read"),
  getCaseByDeviceId,
);

manitCaseRout
  .route("/:id")
  .get(authService.protect, authService.allowedTo("maintenance.case.read"), getOneManitenaceCase)
  .put(
    authService.protect,
    authService.allowedTo("maintenance.case.update"),
    authService.checkCompanyEditable,
    updateManitenaceCase,
  )
  .delete(authService.protect, authService.allowedTo("maintenance.case.update"), deleteManitenaceCase);

module.exports = manitCaseRout;
