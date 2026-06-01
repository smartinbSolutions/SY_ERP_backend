// Utility function to safely parse JSON strings, with a fallback for invalid inputs.
//بتقبل قيمة و تحاول تحولها ل JSON لو كانت string، لو مش ممكن ترجع القيمة نفسها أو قيمة افتراضية.

const safeParse = (value, fallback = null) => {
  if (value === undefined || value === null || value === "") return fallback;

  if (typeof value === "object") return value;

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  return fallback;
};

const normalizeIds = (arr) =>
  Array.isArray(arr) ? arr.map((x) => x?.id || x).filter(Boolean) : [];
module.exports = safeParse;
