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
  .post(
    authService.allowedTo("sales.quotation.create"),
    authService.checkCompanyEditable,
    createCashQuotation
  )
  .get(authService.allowedTo("sales.quotation.read"), getAllQuotations);
quotationRouter.route("/archive/:id").put(
  authService.allowedTo("sales.quotation.update.status"),
  authService.checkCompanyEditable,
  archiveQuotation
);
// Get / update / delete a specific quotation by ID
quotationRouter
  .route("/:id")
  .get(authService.allowedTo("sales.quotation.read"), getQuotationById)
  .put(
    authService.allowedTo("sales.quotation.update.draft"),
    authService.checkCompanyEditable,
    updateQuotation
  );

module.exports = quotationRouter;
