const express = require("express");
const {
  createCashQuotation,
  getAllQuotations,
  getQuotationById,
  updateQuotation,
  archiveQuotation,
} = require("../services/quotationServices");
const authService = require("../services/authService");

const quotationRouter = express.Router();
quotationRouter.use(authService.protect);

// Create a new quotation / Get all quotations
quotationRouter
  .route("/")
  .post(authService.checkCompanyEditable, createCashQuotation)
  .get(getAllQuotations);
quotationRouter.route("/archive/:id").put(archiveQuotation);
// Get / update / delete a specific quotation by ID
quotationRouter
  .route("/:id")
  .get(getQuotationById)
  .put(authService.checkCompanyEditable, updateQuotation);

module.exports = quotationRouter;
