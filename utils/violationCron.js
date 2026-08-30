const cron = require("node-cron");

require("dotenv").config({
  path: "config.env",
});

const {
  processDailyAbsenceViolationsService,
} = require("../services/Hr/Deductions/violationLogsService");

// Run once every day at 00:00:00
cron.schedule("0 0 0 * * *", async () => {
  try {
    await processDailyAbsenceViolationsService();
  } catch (err) {
    console.error("Daily Absence Job Failed:", err);
  }
});