// utils/buildBase.js
const pad = (n, len = 2) => String(n).padStart(len, "0");

exports.buildBase = ({
  dateFormat = "YYYYMMDD",
  digits,
  date = new Date(),
}) => {
  const d = Number(digits);
  if (!Number.isInteger(d) || d < 1) {
    throw new Error(`buildBase: invalid digits (${digits})`);
  }

  const datePart = String(dateFormat)
    .replace(/YYYY/g, pad(date.getFullYear(), 4))
    .replace(/YY/g, pad(date.getFullYear() % 100))
    .replace(/MM/g, pad(date.getMonth() + 1))
    .replace(/DD/g, pad(date.getDate()));

  return `${datePart}${"0".repeat(d)}`; // e.g. "20261020" + "0000"
};
