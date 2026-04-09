const express = require("express");

const authService = require("../services/authService");
const {
  createInvoiceExpenses,
  uploadFile,
  getInvoiceExpenses,
  getInvoiceExpense,
  updateInvoiceExpense,
  createExpenses,
  getExpenses,
  updateExpense,
  getExpense,
  cancelExpense,
  getExpenseAndPurchaseForSupplier,
  archiveExpense,
  patchExpense,
  createNoSupplierExpenses,
  cancelNoSupplierExpense,
} = require("../services/expenseService");

const expensesRoute = express.Router();

// expensesRoute.use(authService.protect);
expensesRoute
  .route("/")
  .post(authService.checkCompanyEditable, uploadFile, createInvoiceExpenses)
  .get(getInvoiceExpenses);
expensesRoute
  .route("/cash")
  .post(authService.protect, uploadFile, createNoSupplierExpenses);
expensesRoute
  .route("/archive/:id")
  .put(authService.checkCompanyEditable, archiveExpense);
expensesRoute
  .route("/:id")
  .get(getInvoiceExpense)
  .put(authService.checkCompanyEditable, uploadFile, updateInvoiceExpense)
  .delete(authService.checkCompanyEditable, cancelExpense)
  .patch(authService.checkCompanyEditable, uploadFile, patchExpense);
expensesRoute
  .route("/expense/:id")

  .put(authService.checkCompanyEditable, cancelNoSupplierExpense);

expensesRoute
  .route("/purchaseandexpence/:id")
  .get(getExpenseAndPurchaseForSupplier);

module.exports = expensesRoute;
