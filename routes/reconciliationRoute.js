const express = require("express");

const authService = require("../services/authService");
const {
  getReconciliations,
  createReconciliatio,
  getOneReconciliatio,
  deleteReconciliatio,
  getAllReconciliationsForAccount,
} = require("../services/reconciliationServices");

const reconciliationRoute = express.Router();

reconciliationRoute.use(
  authService.checkPlanFeatures("inventory"),
  authService.protect,
);

reconciliationRoute
  .route("/")
  .get(getReconciliations)
  .post(authService.checkCompanyEditable, createReconciliatio);
reconciliationRoute.route("/jornal/:id").get(getAllReconciliationsForAccount);
reconciliationRoute
  .route("/:id")
  .get(getOneReconciliatio)
  .delete(authService.checkCompanyEditable, deleteReconciliatio);

module.exports = reconciliationRoute;
