const express = require("express");

const authService = require("../../services/authService");
const {
  getStaff,
  createStaff,
  getOneStaff,
  updateStaff,
  deleteStaff,
  uploadStaffAssets,
  processProfileImage,
  processStaffFiles,
} = require("../../services/Hr/staffServices");

const staffRout = express.Router();

/* ===================== GET STAFF ===================== */
staffRout.route("/").get(getStaff);

/* ===================== CREATE STAFF ===================== */
staffRout.post(
  "/",
  uploadStaffAssets,
  processProfileImage,
  processStaffFiles,
  createStaff
);

staffRout
  .route("/:id")
  .get(getOneStaff)
  .put(uploadStaffAssets, processProfileImage, processStaffFiles, updateStaff)
  .delete(deleteStaff);

module.exports = staffRout;
