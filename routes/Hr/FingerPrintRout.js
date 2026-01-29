const express = require("express");
const hrAuthServices = require("../../services/Hr/hrAuthServices");
const {
  getFingerPrint,
  deleteFingerprint,
  updateFingerPrint,
  getOneFingerPrint,
  getLoggedUserFingerPrint,
  calculateSalaryFlexible,
  createLoggedFingerPrint,
  createFingerPrint,
  getTodayFingerPrint,
} = require("../../services/Hr/fingerPrintServices");
const authService = require("../../services/authService");

const FingerPrintRout = express.Router();

FingerPrintRout.route("/loged")
  .get(hrAuthServices.protectStaffOrERP, getLoggedUserFingerPrint)
  .post(hrAuthServices.protectStaffOrERP, createLoggedFingerPrint);

FingerPrintRout.post(
  "/erp-to-staff",
  hrAuthServices.protectERP,
  hrAuthServices.erpToStaffPortal,
);

FingerPrintRout.route("/logged/today").get(
  hrAuthServices.protectStaffOrERP,
  getTodayFingerPrint,
);

FingerPrintRout.route("/salary").get(
  hrAuthServices.protectStaffOrERP,
  calculateSalaryFlexible,
);

/**
 * 🏢 ERP Admin only
 */
FingerPrintRout.route("/")
  .get(authService.protect, getFingerPrint)
  .post(authService.protect, createFingerPrint);

FingerPrintRout.route("/:id")
  .get(authService.protect, getOneFingerPrint)
  .delete(authService.protect, deleteFingerprint)
  .put(authService.protect, updateFingerPrint);

module.exports = FingerPrintRout;
