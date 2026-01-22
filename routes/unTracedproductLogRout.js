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

unTracedproductLogRout
  .route("/")
  .get(getUnTracedproductLog)
  .post(
    authService.protect,
    authService.checkCompanyEditable,
    createUnTracedproductLog,
  );
unTracedproductLogRout
  .route("/:id")
  .get(getOneUnTracedproductLog)
  .put(
    authService.protect,
    authService.checkCompanyEditable,
    updataUnTracedproductLog,
  )
  .delete(
    authService.protect,
    authService.checkCompanyEditable,
    deleteUnTracedproductLog,
  );

module.exports = unTracedproductLogRout;
