const express = require("express");

const {
  getAllCompanies,
  getOneCompany,
  createCompany,
  updateCompany,
  deleteCompany,
} = require("../../controllers/CRM/company.controller");

const { protect } = require("../../services/authService");

const router = express.Router();

router.use(protect);

router.route("/").get(getAllCompanies).post(createCompany);

router
  .route("/:id")
  .get(getOneCompany)
  .put(updateCompany)
  .delete(deleteCompany);

module.exports = router;
