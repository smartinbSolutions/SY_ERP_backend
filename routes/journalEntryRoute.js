const express = require("express");

const authService = require("../services/authService");
const {
  uploadFileAndImagejournal,
  processFilesAndImagesjournal,
  getJournals,
  getOneJournal,
  createJournal,
  getOneAccountAndJournal,
  updateJournal,
  getOneJournalByLink,
  updateJournalForInvoice,
  auditingJornal,
  createJournalOpenBalance,
} = require("../services/journalEntryServices");

const accountingRoute = express.Router();

accountingRoute.use(authService.protect);

accountingRoute
  .route("/")
  .get(getJournals)
  .post(
    authService.checkCompanyEditable,
    uploadFileAndImagejournal,
    processFilesAndImagesjournal,
    createJournal
  );
accountingRoute
  .route("/openbalance")
  .post(
    authService.checkCompanyEditable,
    uploadFileAndImagejournal,
    processFilesAndImagesjournal,
    createJournalOpenBalance
  );

accountingRoute
  .route("/audit/:id")
  .put(authService.checkCompanyEditable, auditingJornal);
accountingRoute
  .route("/:id")
  .get(getOneJournal)
  .put(
    authService.checkCompanyEditable,
    uploadFileAndImagejournal,
    processFilesAndImagesjournal,
    updateJournal
  );
accountingRoute.route("/accountwithjournal/:id").get(getOneAccountAndJournal);
accountingRoute
  .route("/link/:linkNum")
  .get(getOneJournalByLink)
  .put(
    authService.checkCompanyEditable,
    uploadFileAndImagejournal,
    processFilesAndImagesjournal,
    updateJournalForInvoice
  );
module.exports = accountingRoute;
