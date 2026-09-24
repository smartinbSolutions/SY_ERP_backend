const expensesModel = require("../../models/Accounting/Expenses/expensesModel");
const {
  toNum,
  buildBaseMatch,
  parseReportQuery,
  finalizeGroup,
  pickFacets,
} = require("./reportHelpers");

const ALL_SECTIONS = ["summary", "byCategory", "byTag", "bySupplier"];

const EMPTY_SUMMARY = { count: 0, gross: 0, tax: 0, net: 0, amount: 0 };

exports.getExpensesReportService = async ({ req, companyId }) => {
  const { startDate, endDate, withTax, wanted } = parseReportQuery(
    req.query,
    ALL_SECTIONS,
  );

  const match = buildBaseMatch({ companyId, startDate, endDate });

  // ── Normalize each expense doc ─────────────────────────────────
  // expenceTotalMainCurrency is tax-inclusive
  const normalize = [
    {
      $addFields: {
        taxMain: {
          $cond: [
            { $gt: [{ $size: { $ifNull: ["$taxDetails", []] } }, 0] },
            { $sum: "$taxDetails.amountMain" },
            toNum("$mainCurrencyTax"),
          ],
        },
        grossMain: toNum("$expenceTotalMainCurrency"),
        isCashDoc: {
          $or: [
            { $eq: ["$isCash", true] },
            { $eq: [{ $ifNull: ["$supllier.id", ""] }, ""] },
          ],
        },
        // new docs → categorts[], legacy docs → top-level fields
        cats: {
          $cond: [
            { $gt: [{ $size: { $ifNull: ["$categorts", []] } }, 0] },
            {
              $map: {
                input: "$categorts",
                as: "c",
                in: {
                  id: "$$c.expenseCategoryId",
                  name: "$$c.expenseCategory",
                  w: toNum("$$c.expenceTotalMainCurrency"),
                  rate: toNum("$$c.Tax"),
                },
              },
            },
            [
              {
                id: { $ifNull: ["$expenseCategoryId", "uncategorized"] },
                name: { $ifNull: ["$expenseCategory", "Uncategorized"] },
                w: 1,
                rate: toNum("$Tax"),
              },
            ],
          ],
        },
      },
    },
    {
      $addFields: {
        amount: withTax
          ? "$grossMain"
          : { $subtract: ["$grossMain", "$taxMain"] },
        supplierKey: { $cond: ["$isCashDoc", "cash", "$supllier.id"] },
        supplierName: { $cond: ["$isCashDoc", "Cash", "$supllier.name"] },
        catWeightSum: { $sum: "$cats.w" },
        catCount: { $size: "$cats" },
      },
    },
  ];

  // ── Sections ───────────────────────────────────────────────────
  const facets = {
    summary: [
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          gross: { $sum: "$grossMain" },
          tax: { $sum: "$taxMain" },
          amount: { $sum: "$amount" },
        },
      },
      {
        $project: {
          _id: 0,
          count: 1,
          gross: { $round: ["$gross", 2] },
          tax: { $round: ["$tax", 2] },
          net: { $round: [{ $subtract: ["$gross", "$tax"] }, 2] },
          amount: { $round: ["$amount", 2] },
        },
      },
    ],

    // per-category tax from its own rate (gross is tax-inclusive)
    byCategory: [
      { $unwind: "$cats" },
      {
        $addFields: {
          share: {
            $cond: [
              { $gt: ["$catWeightSum", 0] },
              { $divide: ["$cats.w", "$catWeightSum"] },
              { $divide: [1, "$catCount"] },
            ],
          },
        },
      },
      { $addFields: { catGross: { $multiply: ["$grossMain", "$share"] } } },
      {
        $addFields: {
          catTax: {
            $subtract: [
              "$catGross",
              {
                $divide: [
                  "$catGross",
                  { $add: [1, { $divide: ["$cats.rate", 100] }] },
                ],
              },
            ],
          },
        },
      },
      {
        $group: {
          _id: "$cats.id",
          name: { $first: "$cats.name" },
          amount: {
            $sum: withTax
              ? "$catGross"
              : { $subtract: ["$catGross", "$catTax"] },
          },
          tax: { $sum: "$catTax" },
          count: { $sum: 1 },
        },
      },
      ...finalizeGroup,
    ],

    // multi-tag expense counts fully under each tag
    byTag: [
      { $unwind: { path: "$tag", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ["$tag.id", "untagged"] },
          name: { $first: { $ifNull: ["$tag.name", "Untagged"] } },
          amount: { $sum: "$amount" },
          tax: { $sum: "$taxMain" },
          count: { $sum: 1 },
        },
      },
      ...finalizeGroup,
    ],

    bySupplier: [
      {
        $group: {
          _id: "$supplierKey",
          name: { $first: "$supplierName" },
          amount: { $sum: "$amount" },
          tax: { $sum: "$taxMain" },
          count: { $sum: 1 },
        },
      },
      ...finalizeGroup,
    ],
  };

  const [result] = await expensesModel.aggregate([
    { $match: match },
    ...normalize,
    { $facet: pickFacets(facets, wanted) },
  ]);

  return {
    filters: { startDate, endDate, includeTax: withTax },
    ...result,
    summary: result?.summary?.[0] || EMPTY_SUMMARY,
  };
};
