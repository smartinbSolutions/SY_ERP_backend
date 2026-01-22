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
} = require("../services/accountingTreeServices");
const authService = require("../services/authService");
const multer = require("multer");
const upload = multer();

const accountingTreeRouter = express.Router();

accountingTreeRouter.use(authService.protect);

// Routes
accountingTreeRouter
  .route("/")
  .get(getAccountingTree)
  .post(authService.checkCompanyEditable, createAccountingTree);

accountingTreeRouter.route("/tree").get(getAccountingTreeNoBalance);
accountingTreeRouter
  .route("/treefromjournals")
  .get(getAccountingTreeFromJournals);

accountingTreeRouter
  .route("/import")
  .get(getAccountingTreeForExport)
  .post(
    authService.checkCompanyEditable,
    upload.single("file"),
    importAccountingTree,
  );

accountingTreeRouter
  .route("/change/:id")
  .get(getOneAccountingTree)
  .put(authService.checkCompanyEditable, changeBalance);

accountingTreeRouter
  .route("/:id")
  .put(authService.checkCompanyEditable, updateAccountingTree)
  .get(getAccountingTree)
  .delete(authService.checkCompanyEditable, deleteAccountingTree);

module.exports = accountingTreeRouter;
