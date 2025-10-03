const express = require("express");
const multer = require("multer");

const { hrLogin, hrSingOut } = require("../../services/Hr/hrAuthServices");
const upload = multer();

const hrAuthRout = express.Router();

hrAuthRout.post("/login", hrLogin);
hrAuthRout.post("/singout", hrSingOut);

module.exports = hrAuthRout;
