const express = require("express");
const authService = require("../../../services/authService");
const {
  getTaxs,
  createTax,
  getTax,
  updateTax,
  deleteTax,
} = require("../../../controllers/Settings/Definition/tax.controller");

const taxRout = express.Router();
taxRout.use(authService.protect);

taxRout
  .route("/")
  .get(getTaxs)
  .post(authService.checkCompanyEditable, createTax);

taxRout
  .route("/:id")
  .get(getTax)
  .put(authService.checkCompanyEditable, updateTax)
  .delete(authService.checkCompanyEditable, deleteTax);

module.exports = taxRout;
