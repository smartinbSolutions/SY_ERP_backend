const salesModel = require("../../models/Accounting/Sales/orderModel");
const productModel = require("../../models/Stocks/products/productModel");
const categoryModel = require("../../models/CategoryModel");
const brandModel = require("../../models/Settings/Definition/brand.model");
const { toNum, parseReportQuery, pickFacets } = require("./reportHelpers");

const INVOICE_SECTIONS = ["summary", "byStatus", "byCustomer", "byTag"];
const ITEM_SECTIONS = ["byProduct", "byCategory", "byBrand"];
const ALL_SECTIONS = [...INVOICE_SECTIONS, ...ITEM_SECTIONS];

const EMPTY_SUMMARY = {
  count: 0,
  gross: 0,
  tax: 0,
  net: 0,
  amount: 0,
  cost: 0,
  profit: 0,
};
const EMPTY_STATUS = {
  draft: { count: 0, amount: 0 },
  posted: {
    count: 0,
    amount: 0,
    paid: 0,
    unpaid: 0,
    paidCount: 0,
    unpaidCount: 0,
    partialCount: 0,
  },
};

const round2 = (f) => ({ $round: [f, 2] });
const safeRate = {
  $cond: [
    { $gt: [toNum("$currencyExchangeRate"), 0] },
    toNum("$currencyExchangeRate"),
    1,
  ],
};

// legacy docs without status count as posted unless isDraft
const POSTED_MATCH = {
  status: { $nin: ["draft", "cancelled"] },
  isDraft: { $ne: true },
};

const buildSalesMatch = ({ companyId, startDate, endDate }) => {
  const match = { companyId, status: { $ne: "cancelled" } };
  if (startDate || endDate) {
    match.orderDate = {};
    if (startDate)
      match.orderDate.$gte = new Date(`${startDate}T00:00:00.000Z`);
    if (endDate) match.orderDate.$lte = new Date(`${endDate}T23:59:59.999Z`);
  }
  return match;
};

const finalizeRows = [
  {
    $project: {
      _id: 0,
      id: "$_id",
      name: 1,
      nameAR: 1,
      nameTR: 1,
      count: 1,
      quantity: 1,
      amount: round2("$amount"),
      tax: round2("$tax"),
      cost: round2("$cost"),
      profit: round2("$profit"),
    },
  },
  { $sort: { amount: -1 } },
];

// ── Invoice-level pipeline ────────────────────────────────────────
const invoiceNormalize = (withTax) => [
  {
    $addFields: {
      _rate: safeRate,
      _manual: toNum("$manuallInvoiceDiscountValue"),
      _isDraft: {
        $or: [{ $eq: ["$status", "draft"] }, { $eq: ["$isDraft", true] }],
      },
    },
  },
  {
    $addFields: {
      // real total = grandTotal − manual discount (grandTotal excludes it by design)
      grossMain: {
        $divide: [
          { $subtract: [toNum("$invoiceGrandTotal"), "$_manual"] },
          "$_rate",
        ],
      },
      netMain: {
        $divide: [
          { $subtract: [toNum("$invoiceSubTotal"), "$_manual"] },
          "$_rate",
        ],
      },
      taxMain: { $divide: [toNum("$invoiceTax"), "$_rate"] },
      costMain: {
        $divide: [
          {
            $reduce: {
              input: { $ifNull: ["$invoicesItems", []] },
              initialValue: 0,
              in: {
                $add: [
                  "$$value",
                  {
                    $multiply: [
                      toNum("$$this.convertedBuyingPrice"),
                      toNum("$$this.soldQuantity"),
                    ],
                  },
                ],
              },
            },
          },
          "$_rate",
        ],
      },
      // paid at invoice rate → paid + unpaid always = gross
      paidRaw: {
        $divide: [
          {
            $sum: {
              $map: {
                input: { $ifNull: ["$payments", []] },
                as: "p",
                in: toNum("$$p.paymentInInvoiceCurrency"),
              },
            },
          },
          "$_rate",
        ],
      },
    },
  },
  {
    $addFields: {
      amount: withTax ? "$grossMain" : "$netMain",
      profitMain: { $subtract: ["$netMain", "$costMain"] },
      paidMain: { $min: ["$paidRaw", "$grossMain"] },
    },
  },
  {
    $addFields: {
      unpaidMain: { $max: [0, { $subtract: ["$grossMain", "$paidMain"] }] },
    },
  },
];

const invoiceGroupSums = {
  count: { $sum: 1 },
  amount: { $sum: "$amount" },
  tax: { $sum: "$taxMain" },
  cost: { $sum: "$costMain" },
  profit: { $sum: "$profitMain" },
};

const postedOnly = { $match: { _isDraft: false } };

const invoiceFacets = {
  summary: [
    postedOnly,
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        gross: { $sum: "$grossMain" },
        tax: { $sum: "$taxMain" },
        net: { $sum: "$netMain" },
        amount: { $sum: "$amount" },
        cost: { $sum: "$costMain" },
        profit: { $sum: "$profitMain" },
      },
    },
    {
      $project: {
        _id: 0,
        count: 1,
        gross: round2("$gross"),
        tax: round2("$tax"),
        net: round2("$net"),
        amount: round2("$amount"),
        cost: round2("$cost"),
        profit: round2("$profit"),
      },
    },
  ],

  // always tax-inclusive: paid/unpaid are real money
  byStatus: [
    {
      $group: {
        _id: null,
        draftCount: { $sum: { $cond: ["$_isDraft", 1, 0] } },
        draftAmount: { $sum: { $cond: ["$_isDraft", "$grossMain", 0] } },
        postedCount: { $sum: { $cond: ["$_isDraft", 0, 1] } },
        postedAmount: { $sum: { $cond: ["$_isDraft", 0, "$grossMain"] } },
        paid: { $sum: { $cond: ["$_isDraft", 0, "$paidMain"] } },
        unpaid: { $sum: { $cond: ["$_isDraft", 0, "$unpaidMain"] } },
        paidCount: {
          $sum: {
            $cond: [
              {
                $and: [{ $not: "$_isDraft" }, { $lte: ["$unpaidMain", 0.01] }],
              },
              1,
              0,
            ],
          },
        },
        unpaidCount: {
          $sum: {
            $cond: [
              { $and: [{ $not: "$_isDraft" }, { $gt: ["$unpaidMain", 0.01] }] },
              1,
              0,
            ],
          },
        },
        partialCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $not: "$_isDraft" },
                  { $gt: ["$paidMain", 0.01] },
                  { $gt: ["$unpaidMain", 0.01] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        draft: { count: "$draftCount", amount: round2("$draftAmount") },
        posted: {
          count: "$postedCount",
          amount: round2("$postedAmount"),
          paid: round2("$paid"),
          unpaid: round2("$unpaid"),
          paidCount: "$paidCount",
          unpaidCount: "$unpaidCount",
          partialCount: "$partialCount",
        },
      },
    },
  ],

  byCustomer: [
    postedOnly,
    {
      $group: {
        _id: { $ifNull: ["$customer.id", "noCustomer"] },
        name: { $first: { $ifNull: ["$customer.name", "No customer"] } },
        ...invoiceGroupSums,
      },
    },
    ...finalizeRows,
  ],

  // multi-tag invoice counts fully under each tag
  byTag: [
    postedOnly,
    { $unwind: { path: "$tag", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: { $ifNull: ["$tag.id", "untagged"] },
        name: { $first: { $ifNull: ["$tag.name", "Untagged"] } },
        ...invoiceGroupSums,
      },
    },
    ...finalizeRows,
  ],
};

// ── Item-level pipeline ───────────────────────────────────────────
const itemPipeline = (withTax) => [
  {
    $addFields: {
      _rate: safeRate,
      // manual discount spread across items by their share of subtotal
      _keep: {
        $subtract: [
          1,
          {
            $cond: [
              { $gt: [toNum("$invoiceSubTotal"), 0] },
              {
                $divide: [
                  toNum("$manuallInvoiceDiscountValue"),
                  toNum("$invoiceSubTotal"),
                ],
              },
              0,
            ],
          },
        ],
      },
    },
  },
  { $unwind: "$invoicesItems" },
  {
    $group: {
      _id: { $ifNull: ["$invoicesItems.id", "unknown"] },
      name: { $first: "$invoicesItems.name" },
      quantity: { $sum: toNum("$invoicesItems.soldQuantity") },
      net: {
        $sum: {
          $divide: [
            { $multiply: [toNum("$invoicesItems.totalWithoutTax"), "$_keep"] },
            "$_rate",
          ],
        },
      },
      tax: {
        $sum: {
          $divide: [
            { $multiply: [toNum("$invoicesItems.taxValue"), "$_keep"] },
            "$_rate",
          ],
        },
      },
      cost: {
        $sum: {
          $divide: [
            {
              $multiply: [
                toNum("$invoicesItems.convertedBuyingPrice"),
                toNum("$invoicesItems.soldQuantity"),
              ],
            },
            "$_rate",
          ],
        },
      },
      invoiceIds: { $addToSet: "$_id" },
    },
  },
  // lookups run once per distinct product, not per line
  {
    $addFields: {
      productOid: {
        $convert: {
          input: "$_id",
          to: "objectId",
          onError: null,
          onNull: null,
        },
      },
    },
  },
  {
    $lookup: {
      from: productModel.collection.name,
      localField: "productOid",
      foreignField: "_id",
      as: "product",
    },
  },
  { $addFields: { product: { $arrayElemAt: ["$product", 0] } } },
  {
    $lookup: {
      from: categoryModel.collection.name,
      localField: "product.category",
      foreignField: "_id",
      as: "category",
    },
  },
  {
    $lookup: {
      from: brandModel.collection.name,
      localField: "product.brand",
      foreignField: "_id",
      as: "brand",
    },
  },
  {
    $addFields: {
      category: { $arrayElemAt: ["$category", 0] },
      brand: { $arrayElemAt: ["$brand", 0] },
      amount: withTax ? { $add: ["$net", "$tax"] } : "$net",
      profit: { $subtract: ["$net", "$cost"] },
    },
  },
  { $project: { product: 0, productOid: 0 } },
];

// group product rows by category / brand; count = distinct invoices
const groupByRef = (ref, emptyId, emptyName) => [
  {
    $group: {
      _id: { $ifNull: [{ $toString: `$${ref}._id` }, emptyId] },
      name: { $first: { $ifNull: [`$${ref}.name`, emptyName] } },
      nameAR: { $first: `$${ref}.nameAR` },
      nameTR: { $first: `$${ref}.nameTR` },
      quantity: { $sum: "$quantity" },
      amount: { $sum: "$amount" },
      tax: { $sum: "$tax" },
      cost: { $sum: "$cost" },
      profit: { $sum: "$profit" },
      invoiceSets: { $push: "$invoiceIds" },
    },
  },
  {
    $addFields: {
      count: {
        $size: {
          $reduce: {
            input: "$invoiceSets",
            initialValue: [],
            in: { $setUnion: ["$$value", "$$this"] },
          },
        },
      },
    },
  },
  ...finalizeRows,
];

const itemFacets = {
  byProduct: [
    { $addFields: { count: { $size: "$invoiceIds" } } },
    ...finalizeRows,
  ],
  byCategory: groupByRef("category", "uncategorized", "Uncategorized"),
  byBrand: groupByRef("brand", "noBrand", "No brand"),
};

// ── Service ───────────────────────────────────────────────────────
exports.getSalesReportService = async ({ req, companyId }) => {
  const { startDate, endDate, withTax, wanted } = parseReportQuery(
    req.query,
    ALL_SECTIONS,
  );
  const match = buildSalesMatch({ companyId, startDate, endDate });

  const selectedInvoiceFacets = pickFacets(invoiceFacets, wanted);
  const selectedItemFacets = pickFacets(itemFacets, wanted);

  const [invoiceResult, itemResult] = await Promise.all([
    Object.keys(selectedInvoiceFacets).length
      ? salesModel
          .aggregate([
            { $match: match },
            ...invoiceNormalize(withTax),
            { $facet: selectedInvoiceFacets },
          ])
          .then((r) => r[0])
      : {},
    Object.keys(selectedItemFacets).length
      ? salesModel
          .aggregate([
            { $match: { ...match, ...POSTED_MATCH } },
            ...itemPipeline(withTax),
            { $facet: selectedItemFacets },
          ])
          .then((r) => r[0])
      : {},
  ]);

  return {
    filters: { startDate, endDate, includeTax: withTax },
    ...invoiceResult,
    ...itemResult,
    summary: invoiceResult?.summary?.[0] || EMPTY_SUMMARY,
    byStatus: invoiceResult?.byStatus?.[0] || EMPTY_STATUS,
  };
};
