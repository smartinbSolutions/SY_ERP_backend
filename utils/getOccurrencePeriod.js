const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const customParseFormat = require("dayjs/plugin/customParseFormat");

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

const getOccurrencePeriod = ({
  frequency,
  violationDate,
  hireDate,
  timezone: tz,
}) => {
  if (!timezone) {
    throw new Error("Timezone is required for occurrence calculation");
  }

  const date = dayjs(violationDate).tz(tz);

  let start;
  let end;

  switch (frequency) {
    // =========================
    // DAILY
    // =========================
    case "daily":
      start = date.startOf("day");
      end = date.add(1, "day").startOf("day");
      break;

    // =========================
    // WEEKLY (Sunday-based)
    // =========================
    case "weekly": {
      // get current week Sunday
      const dayOfWeek = date.day(); // Sunday = 0

      start = date.subtract(dayOfWeek, "day").startOf("day");
      end = start.add(7, "day");
      break;
    }

    // =========================
    // MONTHLY
    // =========================
    case "monthly":
      start = date.startOf("month");
      end = date.add(1, "month").startOf("month");
      break;

    // =========================
    // YEARLY
    // =========================
    case "yearly":
      start = date.startOf("year");
      end = date.add(1, "year").startOf("year");
      break;

    // =========================
    // NEVER (based on hireDate)
    // =========================
    case "never":
      if (!hireDate) {
        throw new Error("hireDate is required for 'never' frequency");
      }

      start = dayjs(hireDate).tz(tz).startOf("day");
      end = date.add(1, "millisecond"); // inclusive safe boundary
      break;

    default:
      throw new Error(`Unsupported resetFrequency: ${frequency}`);
  }

  return {
    periodStart: start.toDate(),
    periodEnd: end.toDate(),
  };
};

module.exports = { getOccurrencePeriod };
