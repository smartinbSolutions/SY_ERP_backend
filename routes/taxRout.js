const express = require("express");
const {
  getTax,
  createTax,
  getOneTax,
  updataTax,
  deleteTax,
} = require("../services/taxServices");

const authService = require("../services/authService");
const taxRout = express.Router();

taxRout
  .route("/")
  .get(getTax)
  .post(authService.protect, authService.checkCompanyEditable, createTax);
taxRout
  .route("/:id")
  .get(getOneTax)
  .put(authService.protect, authService.checkCompanyEditable, updataTax)
  .delete(authService.protect, authService.checkCompanyEditable, deleteTax);

module.exports = taxRout;
