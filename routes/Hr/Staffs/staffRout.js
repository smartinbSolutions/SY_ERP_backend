const express = require("express");

const authService = require("../../../services/authService");
const {
  getStaff,
  createStaff,
  getOneStaff,
  updateStaff,
  deleteStaff,
  uploadStaffAssets,
  processProfileImage,
  processStaffFiles,
} = require("../../../services/Hr/Staffs/staffServices");

const staffRout = express.Router();

/* ===================== GET STAFF ===================== */
staffRout
  .route("/")
  .get(authService.protect, authService.allowedTo("employee.read"), getStaff);

/* ===================== CREATE STAFF ===================== */
staffRout.post(
  "/",
  authService.protect,
  authService.allowedTo("employee.create"),
  uploadStaffAssets,
  processProfileImage,
  processStaffFiles,
  createStaff,
);

staffRout
  .route("/:id")
  .get(authService.protect, authService.allowedTo("employee.read"), getOneStaff)
  .put(
    authService.protect,
    authService.allowedTo("employee.update"),
    uploadStaffAssets,
    processProfileImage,
    processStaffFiles,
    updateStaff,
  )
  .delete(
    authService.protect,
    authService.allowedTo("employee.delete"),
    deleteStaff,
  );

module.exports = staffRout;
