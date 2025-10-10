const express = require("express");
const hrAuthServices = require("../../services/Hr/hrAuthServices");
const {
  getFingerPrint,
  deleteFingerprint,
  updateFingerPrint,
  getOneFingerPrint,
  getLoggedUserFingerPrint,
  calculateSalaryFlexible,
  createLogedFingerPrint,
  createFingerPrint,
  getTodayFingerPrint,
} = require("../../services/Hr/fingerPrintServices");
const authService = require("../../services/authService");

const FingerPrintRout = express.Router();
// FingerPrintRout.use();

FingerPrintRout.route("/loged")
  .get(hrAuthServices.protect, getLoggedUserFingerPrint)
  .post(hrAuthServices.protect, createLogedFingerPrint);
  FingerPrintRout.route("/loged/today")
  .get(hrAuthServices.protect, getTodayFingerPrint)
FingerPrintRout.route("/loged/:id").get(
  hrAuthServices.protect,
  getOneFingerPrint
);
FingerPrintRout.route("/salary").get(calculateSalaryFlexible);

FingerPrintRout.route("/")
  .get(authService.protect, getFingerPrint)
  .post(authService.protect, createFingerPrint);

FingerPrintRout.route("/:id")
  .get(authService.protect, getOneFingerPrint)
  .delete(authService.protect, deleteFingerprint)
  .put(authService.protect, updateFingerPrint);
module.exports = FingerPrintRout;
