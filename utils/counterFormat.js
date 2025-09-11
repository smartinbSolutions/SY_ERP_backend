// utils/counterFormat.js

function formatDate(d, fmt) {
  const yyyy = d.getFullYear().toString();
  const yy = yyyy.slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  switch (fmt) {
    case "YYMMDD":
      return `${yy}${mm}${dd}`;
    case "YYYY-MM":
      return `${yyyy}-${mm}`;
    case "YYYY/MM/DD":
      return `${yyyy}/${mm}/${dd}`;
    case "YYYY":
      return yyyy;
    case "YYYYMMDD":
    default:
      return `${yyyy}${mm}${dd}`;
  }
}

function sampleCounter(len) {
  return "0".repeat(len);
}

/**
 * Generate counter string
 * @param {Object} options
 * @param {String} options.dateFormat
 * @param {Number} options.counterFormat
 * @param {Date} [options.date=new Date()]
 */
function generateCounter({ dateFormat, counterFormat, date }) {
  return `${formatDate(date, dateFormat)}${sampleCounter(counterFormat)}`;
}

module.exports = { generateCounter };
