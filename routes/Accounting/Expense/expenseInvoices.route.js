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

ExpenseInvoices.use(
  authService.protect,
  authService.checkPlanFeatures("accounting"),
);

ExpenseInvoices.route("/")
  .post(
    authService.allowedTo("expense.create"),
    authService.checkCompanyEditable,
    uploadFile,
    createExpenseInvoice,
  )
  .get(authService.allowedTo("expense.read"), findAllExpensesInvoices);

ExpenseInvoices.route("/cancel/:id").put(
  authService.allowedTo("expense.cancel"),
  authService.checkCompanyEditable,
  cancelExpenseInvoice,
);
ExpenseInvoices.route("/cancel/iscash/:id").put(
  authService.allowedTo("expense.cancel"),
  authService.checkCompanyEditable,
  cancelNoSupplierExpense,
);
ExpenseInvoices.route("/update/:id").put(
  authService.allowedTo("expense.update"),
  authService.checkCompanyEditable,
  uploadFile,
  updatePostedExpenseInvoice,
);

ExpenseInvoices.route("/expenseandpurchase/:id").get(
  authService.allowedTo("expense.read"),
  findAllExpensesAndPurchaseInvoices,
);
ExpenseInvoices.route("/:id").get(
  authService.allowedTo("expense.read"),
  findOneExpensesInvoice,
);

module.exports = ExpenseInvoices;
