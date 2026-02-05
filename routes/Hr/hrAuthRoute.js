const express = require("express");
const multer = require("multer");

const {
  hrLogin,
  hrSignOut,
  forgotPassword,
  resetPassword,
  verifyPasswordResetCode,
} = require("../../services/Hr/hrAuthServices");

const hrAuthRout = express.Router();

hrAuthRout.post("/login", hrLogin);
hrAuthRout.post("/signout", hrSignOut);
hrAuthRout.post("/forgot-password", forgotPassword);
hrAuthRout.post("/verify-resetcode", verifyPasswordResetCode);
hrAuthRout.post("/reset-password", resetPassword);

module.exports = hrAuthRout;
