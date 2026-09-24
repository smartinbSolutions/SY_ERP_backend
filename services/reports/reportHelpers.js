// Safe numeric conversion (handles String / NumberInt / Double / null)
exports.toNum = (field) => ({
  $convert: { input: field, to: "double", onError: 0, onNull: 0 },
});

// Base match shared by expenses / sales / purchases
// $nin keeps legacy docs that have no status field
exports.buildBaseMatch = ({
  companyId,
  startDate,
  endDate,
  dateField = "date",
}) => {
  const match = { companyId, status: { $nin: ["draft", "cancelled"] } };

  if (startDate || endDate) {
    match[dateField] = {};
    if (startDate) match[dateField].$gte = startDate;
    if (endDate) match[dateField].$lte = `${endDate}T23:59:59.999Z`;
  }

  return match;
};

exports.parseReportQuery = (query, allSections) => ({
  startDate: query.startDate,
  endDate: query.endDate,
  withTax: query.includeTax === undefined || query.includeTax === "true",
  wanted: query.sections ? query.sections.split(",") : allSections,
});

// Common output shape for every byX section
exports.finalizeGroup = [
  {
    $project: {
      _id: 0,
      id: "$_id",
      name: 1,
      count: 1,
      amount: { $round: ["$amount", 2] },
      tax: { $round: ["$tax", 2] },
    },
  },
  { $sort: { amount: -1 } },
];

exports.pickFacets = (facets, wanted) =>
  Object.fromEntries(
    Object.entries(facets).filter(([key]) => wanted.includes(key)),
  );
