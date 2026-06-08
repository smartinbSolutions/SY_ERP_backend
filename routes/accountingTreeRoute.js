const express = require("express");
const {
  getAccountingTree,
  createAccountingTree,
  updateAccountingTree,
  deleteAccountingTree,
  getAccountingTreeNoBalance,
  importAccountingTree,
  changeBalance,
  getOneAccountingTree,
  getAccountingTreeForExport,
  getAccountingTreeFromJournals,
  calculateBalance,
  getChartOfAccounts,
} = require("../services/accountingTreeServices");
const authService = require("../services/authService");
const multer = require("multer");
const upload = multer();

const accountingTreeRouter = express.Router();

accountingTreeRouter.use(
  authService.protect,
  authService.checkPlanFeatures("accounting"),
);

// Routes
accountingTreeRouter
  .route("/")
  .get(authService.allowedTo("chart_of_accounts.read"), getAccountingTree)
  .post(
    authService.allowedTo("chart_of_accounts.create"),
    authService.checkCompanyEditable,
    createAccountingTree,
  );
accountingTreeRouter
  .route("/calculatebalance")
  .get(authService.allowedTo("chart_of_accounts.read"), calculateBalance)
  .get(
    authService.allowedTo("chart_of_accounts.read"),
    getAccountingTreeNoBalance,
  );
accountingTreeRouter
  .route("/tree")
  .get(
    authService.allowedTo("chart_of_accounts.read"),
    getAccountingTreeNoBalance,
  );
accountingTreeRouter
  .route("/chart-off-accounts")
  .get(authService.allowedTo("chart_of_accounts.read"), getChartOfAccounts);
accountingTreeRouter
  .route("/treefromjournals")
  .get(
    authService.allowedTo("chart_of_accounts.read"),
    getAccountingTreeFromJournals,
  );

accountingTreeRouter
  .route("/import")
  .get(
    authService.allowedTo("chart_of_accounts.export"),
    getAccountingTreeForExport,
  )
  .post(
    authService.allowedTo("chart_of_accounts.create"),
    authService.checkCompanyEditable,
    upload.single("file"),
    importAccountingTree,
  );

accountingTreeRouter
  .route("/change/:id")
  .get(authService.allowedTo("chart_of_accounts.read"), getOneAccountingTree)
  .put(
    authService.allowedTo("chart_of_accounts.update"),
    authService.checkCompanyEditable,
    changeBalance,
  );

accountingTreeRouter
  .route("/:id")
  .put(
    authService.allowedTo("chart_of_accounts.update"),
    authService.checkCompanyEditable,
    updateAccountingTree,
  )
  .get(authService.allowedTo("chart_of_accounts.read"), getAccountingTree)
  .delete(
    authService.allowedTo("chart_of_accounts.delete"),
    authService.checkCompanyEditable,
    deleteAccountingTree,
  );

module.exports = accountingTreeRouter;
