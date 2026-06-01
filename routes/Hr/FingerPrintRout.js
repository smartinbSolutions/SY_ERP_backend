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
  getLoggedUserFingerPrintsByDays,
} = require("../../services/Hr/fingerPrintServices");
const authService = require("../../services/authService");

const FingerPrintRout = express.Router();

FingerPrintRout.route("/loged")
  .get(hrAuthServices.protectStaffOrERP, getLoggedUserFingerPrint)
  .post(hrAuthServices.protectStaffOrERP, createLoggedFingerPrint);

FingerPrintRout.route("/days").get(
  hrAuthServices.protectStaffOrERP,
  getLoggedUserFingerPrintsByDays,
);

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
  .get(authService.protect, authService.allowedTo("fingerprints.read"), getFingerPrint)
  .post(authService.protect, authService.allowedTo("fingerprints.read"), createFingerPrint);

FingerPrintRout.route("/:id")
  .get(authService.protect, authService.allowedTo("fingerprints.read"), getOneFingerPrint)
  .delete(authService.protect, authService.allowedTo("fingerprints.read"), deleteFingerprint)
  .put(authService.protect, authService.allowedTo("fingerprints.read"), updateFingerPrint);

module.exports = FingerPrintRout;
