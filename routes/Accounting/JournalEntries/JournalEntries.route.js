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
} = require("../../../controllers/Accounting/journalEntries/JournalEntries.controller");

const journalEntriesRoute = express.Router();

journalEntriesRoute.use(
  authService.checkPlanFeatures("accounting"),
  authService.protect,
);

journalEntriesRoute
  .route("/")
  .get(authService.allowedTo("journal_entry.read"), getJournals)
  .post(
    authService.allowedTo("journal_entry.create"),
    authService.checkCompanyEditable,
    uploadFileAndImagejournal,
    processFilesAndImagesjournal,
    createJournal,
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
