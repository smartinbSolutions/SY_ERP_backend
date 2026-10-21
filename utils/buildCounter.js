// utils/buildCounter.js (pure)
exports.buildCounter = ({ base, seq, digits }) => {
  const d = Number(digits);
  if (!Number.isInteger(d) || d < 1) {
    throw new Error(`buildCounter: invalid digits (${digits})`);
  }

  const baseStr = String(base ?? "");
  if (baseStr.length <= d) {
    throw new Error(
      `buildCounter: base "${baseStr}" is too short for ${d} digits`,
    );
  }

  const datePart = baseStr.slice(0, -d);
  return `${datePart}${String(seq).padStart(d, "0")}`;
};
