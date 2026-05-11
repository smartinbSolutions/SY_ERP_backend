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

journalEntriesRoute.use(authService.protect);

journalEntriesRoute
  .route("/")
  .get(getJournals)
  .post(
    authService.checkCompanyEditable,
    uploadFileAndImagejournal,
    processFilesAndImagesjournal,
    createJournal
  );

journalEntriesRoute
  .route("/audit/:id")
  .put(authService.checkCompanyEditable, auditingJournal);

journalEntriesRoute.route("/:id").get(getOneJournal);

journalEntriesRoute.route("/link/:linkNum").get(getOneJournalByLink);

journalEntriesRoute
  .route("/accountwithjournal/:id")
  .get(getOneAccountAndJournal);

module.exports = journalEntriesRoute;
