const express = require("express");
const multer = require("multer");

const { hrLogin, hrSignOut } = require("../../services/Hr/hrAuthServices");

const hrAuthRout = express.Router();

hrAuthRout.post("/login", hrLogin);
hrAuthRout.post("/signout", hrSignOut);

module.exports = hrAuthRout;
