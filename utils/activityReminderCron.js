require("dotenv").config({ path: "config.env" });

const cron = require("node-cron");
const {
  processActivityRemindersService,
} = require("../services/Notification/activityReminderService");

let isRunning = false;

// Run every 5 minutes.
cron.schedule("0 */5 * * * *", async () => {
  const startedAt = new Date();

  if (isRunning) {
    return;
  }

  isRunning = true;

  try {
    await processActivityRemindersService();
  } catch (error) {
  } finally {
    isRunning = false;
  }
});
