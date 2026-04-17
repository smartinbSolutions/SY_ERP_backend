const cron = require("node-cron");
const {
  processDailyAbsenceViolations,
} = require("../services/Hr/violationLogsService");

cron.schedule("0 1 * * *", async () => {
  console.log("🚀 Running Daily Absence Violation Job...");

  try {
    await processDailyAbsenceViolations();
    console.log("✅ Absence job completed");
  } catch (err) {
    console.error("❌ Absence job failed:", err.message);
  }
});
