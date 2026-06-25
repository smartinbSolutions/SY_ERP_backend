const express = require("express");
const authService = require("../../../services/authService");
const {
  createQuotation,
  getAllQuotations,
  updateQuotation,
  getOneQuotation,
} = require("../../../controllers/Accounting/Sales/quotation.controller");

const quotationRouter = express.Router();

quotationRouter.use(
  authService.protect,
  authService.checkPlanFeatures("accounting"),
);

quotationRouter
  .route("/")
  .post(
    authService.allowedTo("sales.quotation.create"),
    authService.checkCompanyEditable,
    createQuotation,
  )
  .get(authService.allowedTo("sales.quotation.read"), getAllQuotations);

quotationRouter
  .route("/:id")
  .get(authService.allowedTo("sales.quotation.read"), getOneQuotation)
  .put(
    authService.allowedTo("sales.quotation.update.draft"),
    authService.checkCompanyEditable,
    updateQuotation,
  );

module.exports = quotationRouter;
