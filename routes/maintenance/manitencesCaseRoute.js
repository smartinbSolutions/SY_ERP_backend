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

manitCaseRout.use(
  authService.checkPlanFeatures("maintenance"),
  authService.protect,
);

manitCaseRout
  .route("/maintenancecase/:counter")
  .get(getOneManitenaceCaseForUser);
manitCaseRout
  .route("/")
  .get(authService.allowedTo("maintenance.case.read"), getManitenaceCase)
  .post(
    authService.allowedTo("maintenance.case.create"),
    authService.checkCompanyEditable,
    createManitenaceCase,
  );
manitCaseRout
  .route("/addproduct/:id")
  .put(
    authService.allowedTo("maintenance.case.update"),
    authService.checkCompanyEditable,
    addProductInManitencesCase,
  );
manitCaseRout
  .route("/addcalling/:id")
  .put(
    authService.allowedTo("maintenance.case.add_connection"),
    authService.checkCompanyEditable,
    addCalling,
  );
manitCaseRout
  .route("/convert/:id")
  .put(
    authService.allowedTo("maintenance.case.convert_to_invoice"),
    authService.checkCompanyEditable,
    convertToSales,
  );
manitCaseRout
  .route("/devicecases/:id")
  .get(authService.allowedTo("maintenance.case.read"), getCaseByDeviceId);

manitCaseRout
  .route("/:id")
  .get(authService.allowedTo("maintenance.case.read"), getOneManitenaceCase)
  .put(
    authService.allowedTo("maintenance.case.update"),
    authService.checkCompanyEditable,
    updateManitenaceCase,
  )
  .delete(
    authService.allowedTo("maintenance.case.update"),
    deleteManitenaceCase,
  );

module.exports = manitCaseRout;
