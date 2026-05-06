const express = require("express");

const authService = require("../../../services/authService");

const expenseCategoriesRoute = express.Router();

const {
  createExpenseCategory,
  getExpenseCategories,
  getOneExpenseCategory,
  deleteOneExpenseCategory,
  updateOneExpenseCategory,
} = require("../../../services/Accounting/Expenses/expensesCategoryService");

expenseCategoriesRoute.use(authService.protect);
expenseCategoriesRoute
  .route("/")
  .post(authService.checkCompanyEditable, createExpenseCategory)
  .get(getExpenseCategories);
expenseCategoriesRoute
  .route("/:id")
  .get(getOneExpenseCategory)
  .delete(authService.checkCompanyEditable, deleteOneExpenseCategory)
  .put(authService.checkCompanyEditable, updateOneExpenseCategory);

module.exports = expenseCategoriesRoute;
