const express = require("express");
const {
  getSupplierVlaidator,
  deleteSupplierVlaidator,
} = require("../utils/validators/supplierValidator");
const {
  createSupplier,
  getSuppliers,
  getSupplier,
  updataSupplier,
  deleteSupplier,
} = require("../services/supplierServices");

const authService = require("../services/authService");
const router = express.Router();
router.use(authService.protect);

router
  .route("/")
  .post(
    authService.allowedTo("supplier.create"),
    authService.checkCompanyEditable,
    createSupplier
  )
  .get(authService.allowedTo("supplier.read"), getSuppliers);

router
  .route("/:id")
  .get(authService.allowedTo("supplier.read"), getSupplierVlaidator, getSupplier)
  .put(
    authService.allowedTo("supplier.update"),
    authService.checkCompanyEditable,
    updataSupplier
  )
  .delete(
    authService.allowedTo("supplier.delete"),
    deleteSupplierVlaidator,
    authService.checkCompanyEditable,
    deleteSupplier,
  );

module.exports = router;
