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
const { uploadFile } = require("../../../services/expenseService");

const ExpenseInvoices = express.Router();

ExpenseInvoices.use(authService.protect);

ExpenseInvoices.route("/")
  .post(authService.checkCompanyEditable, uploadFile, createExpenseInvoice)
  .get(findAllExpensesInvoices);

ExpenseInvoices.route("/cancel/:id").put(
  authService.checkCompanyEditable,
  cancelExpenseInvoice,
);
ExpenseInvoices.route("/cancel/iscash/:id").put(
  authService.checkCompanyEditable,
  cancelNoSupplierExpense,
);
ExpenseInvoices.route("/update/:id").put(
  authService.checkCompanyEditable,
  uploadFile,
  updatePostedExpenseInvoice,
);

ExpenseInvoices.route("/expense/:id").get(findAllExpensesAndPurchaseInvoices);
ExpenseInvoices.route("/:id").get(findOneExpensesInvoice);

module.exports = ExpenseInvoices;
