const express = require("express");
const authService = require("../../../services/authService");
const {
  createExpenseInvoice,
  findAllExpensesInvoices,
  findOneExpensesInvoice,
  cancelExpenseInvoice,
  updatePostedExpenseInvoice,
  cancelNoSupplierExpense,
  findAllExpensesAndPurchaseInvoices,
} = require("../../../controllers/Accounting/Expenses/Expenses.controller");
const {
  uploadFile,
} = require("../../../services/Accounting/Expenses/Expenses.service");

const ExpenseInvoices = express.Router();

ExpenseInvoices.use(authService.protect);

ExpenseInvoices.route("/")
  .post(authService.checkCompanyEditable, uploadFile, createExpenseInvoice)
  .get(findAllExpensesInvoices);

ExpenseInvoices.route("/cancel/:id").put(
  authService.checkCompanyEditable,
  cancelExpenseInvoice
);
ExpenseInvoices.route("/cancel/iscash/:id").put(
  authService.checkCompanyEditable,
  cancelNoSupplierExpense
);
ExpenseInvoices.route("/update/:id").put(
  authService.checkCompanyEditable,
  uploadFile,
  updatePostedExpenseInvoice
);

ExpenseInvoices.route("/expenseandpurchase/:id").get(
  findAllExpensesAndPurchaseInvoices
);
ExpenseInvoices.route("/:id").get(findOneExpensesInvoice);

module.exports = ExpenseInvoices;
