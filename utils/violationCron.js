require(".././models/Hr/groupsModel");
require(".././models/Hr/staffModel");
require(".././models/Hr/fingerprintModel");
require(".././models/Hr/violationLogModel");
require("dotenv").config({ path: "config.env" });
const mongoose = require("mongoose");
const {
  processDailyAbsenceViolations,
} = require("../services/Hr/violationLogsService");

async function runAbsenceJob() {
  console.log("🚀 Absence Job Started...");

  try {
    await mongoose.connect(process.env.DB_URI);

    console.log("✅ DB Connected");

  await processDailyAbsenceViolations();

    console.log("✅ Job Completed");
  } catch (err) {
    console.error("❌ Job Failed:", err.message);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 DB Disconnected");
    process.exit(0);
  }
}

runAbsenceJob();
