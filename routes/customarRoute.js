const express = require("express");
const router = express.Router();
const authService = require("../services/authService");
const {
  createCustomar,
  getCustomars,
  getCustomar,
  updataCustomar,
  deleteCustomar,
  updateCustomerPassword,
  importCustomer,
} = require("../services/customarServices");
const multer = require("multer");
const upload = multer();
router.route("/e-edit/:id").put(authService.ecommerceProtect, updataCustomar);
router
  .route("/updatePassword")
  .put(authService.ecommerceProtect, updateCustomerPassword);
router
  .route("/")
  .post(authService.protect, authService.checkCompanyEditable, createCustomar)
  .get(authService.protect, getCustomars);
router
  .route("/:id")
  .get(authService.protect, getCustomar)
  .put(authService.protect, authService.checkCompanyEditable, updataCustomar)
  .delete(
    authService.protect,
    authService.checkCompanyEditable,
    deleteCustomar,
  );

module.exports = router;
