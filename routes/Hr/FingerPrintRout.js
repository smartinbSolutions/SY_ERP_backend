const express = require("express");
const hrAuthServices =require("../../services/Hr/hrAuthServices")
const {
  createFingerPrint,
  getFingerPrint,
  deleteFingerprint,
  updateFingerPrint,
  getOneFingerPrint,
  getLoggedUserFingerPrint,
  calculateSalaryFlexible,
} = require("../../services/Hr/fingerPrintServices");

const FingerPrintRout = express.Router();
FingerPrintRout.use(hrAuthServices.protect);

FingerPrintRout.route("/loged").get(getLoggedUserFingerPrint);
FingerPrintRout.route("/salary").get(calculateSalaryFlexible);

FingerPrintRout.route("/").get(getFingerPrint).post(createFingerPrint);
FingerPrintRout.route("/:id")
  .get(getOneFingerPrint)
  .delete(deleteFingerprint)
  .put(updateFingerPrint);
module.exports = FingerPrintRout;
