const express = require("express");

const authService = require("../../../services/authService");
const {
  getJournals,
  createJournal,
  processFilesAndImagesjournal,
  getOneJournal,
  uploadFileAndImagejournal,
  auditingJournal,
  getOneJournalByLink,
  getOneAccountAndJournal,
  createOpeningBalanceJournal,
} = require("../../../controllers/Accounting/journalEntries/JournalEntries.controller");
const loadCounterDigits = require("../../../middlewares/loadCounterDigits");

const journalEntriesRoute = express.Router();

journalEntriesRoute.use(
  authService.protect,
  authService.checkPlanFeatures("accounting"),
);

journalEntriesRoute
  .route("/")
  .get(authService.allowedTo("journal_entry.read"), getJournals)
  .post(
    authService.allowedTo("journal_entry.create"),
    authService.checkCompanyEditable,
    uploadFileAndImagejournal,
    processFilesAndImagesjournal,
    loadCounterDigits,
    createJournal,
  );

journalEntriesRoute
  .route("/openingbalance")
  .get(authService.allowedTo("journal_entry.read"), getJournals)
  .post(
    authService.allowedTo("journal_entry.create"),
    authService.checkCompanyEditable,
    uploadFileAndImagejournal,
    processFilesAndImagesjournal,
    loadCounterDigits,
    createOpeningBalanceJournal,
  );

journalEntriesRoute
  .route("/audit/:id")
  .put(
    authService.allowedTo("journal_entry.create"),
    authService.checkCompanyEditable,
    auditingJournal,
  );

journalEntriesRoute
  .route("/:id")
  .get(authService.allowedTo("journal_entry.read"), getOneJournal);

journalEntriesRoute
  .route("/link/:linkNum")
  .get(authService.allowedTo("journal_entry.read"), getOneJournalByLink);

journalEntriesRoute
  .route("/accountwithjournal/:id")
  .get(authService.allowedTo("journal_entry.read"), getOneAccountAndJournal);

module.exports = journalEntriesRoute;
