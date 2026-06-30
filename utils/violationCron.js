const cron = require("node-cron");
const mongoose = require("mongoose");
require("dotenv").config({ path: "config.env" });

const {
  processDailyAbsenceViolationsService,
} = require("../services/Hr/Deductions/violationLogsService");

console.log("🚀 Cron Service Started...");

cron.schedule("0 0 */12 * * *", async () => {
  console.log("\n⏰ Running Daily Absence Job...");

  try {
    await mongoose.connect(process.env.DB_URI);
    console.log("✅ DB Connected");

    await processDailyAbsenceViolationsService();

    console.log("✅ Job Completed");
  } catch (err) {
    console.error("❌ Job Failed:", err.message);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 DB Disconnected");
  }
});
