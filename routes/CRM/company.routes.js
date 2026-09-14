const express = require("express");

const {
  getAllCompanies,
  getOneCompany,
  createCompany,
  updateCompany,
  deleteCompany,
} = require("../../controllers/CRM/company.controller");

const router = express.Router();

router.route("/").get(getAllCompanies).post(createCompany);

router
  .route("/:id")
  .get(getOneCompany)
  .put(updateCompany)
  .delete(deleteCompany);

module.exports = router;
