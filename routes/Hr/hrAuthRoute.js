const express = require("express");

const {
  hrLogin,
  hrSignOut,
  forgotPassword,
  resetPassword,
  verifyPasswordResetCode,
  hrSwitchCompany,
} = require("../../services/Hr/hrAuthServices");

const hrAuthRout = express.Router();

hrAuthRout.post("/login", hrLogin);
hrAuthRout.post("/switch-company", hrSwitchCompany);
hrAuthRout.post("/signout", hrSignOut);
hrAuthRout.post("/forgot-password", forgotPassword);
hrAuthRout.post("/verify-resetcode", verifyPasswordResetCode);
hrAuthRout.post("/reset-password", resetPassword);

module.exports = hrAuthRout;
