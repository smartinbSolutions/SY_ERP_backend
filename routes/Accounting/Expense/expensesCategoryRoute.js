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

expenseCategoriesRoute.use(
  authService.checkPlanFeatures("accounting"),
  authService.protect,
);
expenseCategoriesRoute
  .route("/")
  .post(
    authService.allowedTo("expense.categories.create"),
    authService.checkCompanyEditable,
    createExpenseCategory,
  )
  .get(authService.allowedTo("expense.categories.read"), getExpenseCategories);
expenseCategoriesRoute
  .route("/:id")
  .get(authService.allowedTo("expense.categories.read"), getOneExpenseCategory)
  .delete(
    authService.allowedTo("expense.categories.delete"),
    authService.checkCompanyEditable,
    deleteOneExpenseCategory,
  )
  .put(
    authService.allowedTo("expense.categories.update"),
    authService.checkCompanyEditable,
    updateOneExpenseCategory,
  );

module.exports = expenseCategoriesRoute;
