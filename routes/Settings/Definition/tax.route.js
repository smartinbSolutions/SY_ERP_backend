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
  .get(authService.allowedTo("definition.read"), getTaxs)
  .post(
    authService.allowedTo("definition.create"),
    authService.checkCompanyEditable,
    createTax,
  );

taxRout
  .route("/:id")
  .get(authService.allowedTo("definition.read"), getTax)
  .put(
    authService.allowedTo("definition.update"),
    authService.checkCompanyEditable,
    updateTax,
  )
  .delete(
    authService.allowedTo("definition.delete"),
    authService.checkCompanyEditable,
    deleteTax,
  );

module.exports = taxRout;
