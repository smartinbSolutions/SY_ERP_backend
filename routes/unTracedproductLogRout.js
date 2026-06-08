const express = require("express");

const authService = require("../services/authService");
const {
  createUnTracedproductLog,
  getUnTracedproductLog,
  getOneUnTracedproductLog,
  updataUnTracedproductLog,
  deleteUnTracedproductLog,
} = require("../services/unTracedproductServices");
const unTracedproductLogRout = express.Router();

unTracedproductLogRout.use(
  authService.checkPlanFeatures("inventory"),
  authService.protect,
);

unTracedproductLogRout
  .route("/")
  .get(getUnTracedproductLog)
  .post(authService.checkCompanyEditable, createUnTracedproductLog);
unTracedproductLogRout
  .route("/:id")
  .get(getOneUnTracedproductLog)
  .put(authService.checkCompanyEditable, updataUnTracedproductLog)
  .delete(authService.checkCompanyEditable, deleteUnTracedproductLog);

module.exports = unTracedproductLogRout;
