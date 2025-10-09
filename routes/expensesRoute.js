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
} = require("../services/expenseService");

const expensesRoute = express.Router();

expensesRoute.use(authService.protect);
expensesRoute
  .route("/")
  .post(uploadFile, createInvoiceExpenses)
  .get(getInvoiceExpenses);

expensesRoute.route("/archive/:id").put(archiveExpense);
expensesRoute
  .route("/:id")
  .get(getInvoiceExpense)
  .put(uploadFile, updateInvoiceExpense)
  .delete(cancelExpense)
  .patch(uploadFile, patchExpense);

expensesRoute
  .route("/purchaseandexpence/:id")
  .get(getExpenseAndPurchaseForSupplier);

module.exports = expensesRoute;
