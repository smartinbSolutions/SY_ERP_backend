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

reconciliationRoute.use(authService.protect);

reconciliationRoute
  .route("/")
  .get(getReconciliations)
  .post(createReconciliatio);
reconciliationRoute.route("/jornal/:id").get(getAllReconciliationsForAccount);
reconciliationRoute
  .route("/:id")
  .get(getOneReconciliatio)
  .delete(deleteReconciliatio);

module.exports = reconciliationRoute;
