// utils/buildCounter.js (pure)
exports.buildCounter = ({ base, seq, digits = 4 }) => {
  const datePart = String(base ?? "").slice(0, -digits);
  return `${datePart}${String(seq).padStart(digits, "0")}`;
};
