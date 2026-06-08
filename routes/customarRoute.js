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
router.use(authService.protect, authService.checkPlanFeatures("accounting"));

router.route("/e-edit/:id").put(authService.ecommerceProtect, updataCustomar);
router
  .route("/updatePassword")
  .put(authService.ecommerceProtect, updateCustomerPassword);
router
  .route("/")
  .post(
    authService.allowedTo("customer.create"),
    authService.checkCompanyEditable,
    createCustomar,
  )
  .get(authService.allowedTo("customer.read"), getCustomars);
router
  .route("/:id")
  .get(authService.allowedTo("customer.read"), getCustomar)
  .put(
    authService.allowedTo("customer.update"),
    authService.checkCompanyEditable,
    updataCustomar,
  )
  .delete(
    authService.allowedTo("customer.delete"),
    authService.checkCompanyEditable,
    deleteCustomar,
  );

module.exports = router;
