const asyncHandler = require("express-async-handler");
const DashboardStatsSnapshot = require("../models/dashboardStatsSnapshotModel");
const Customer = require("../models/customarModel");
const Supplier = require("../models/Accounting/Purchase/suppliersModel");
const FinancialFund = require("../models/Accounting/CurrentAssets/financialFundsModel");
const SalesInvoice = require("../models/orderModel");
const PurchaseInvoice = require("../models/Accounting/Purchase/purchaseinvoicesModel");
const Expense = require("../models/Accounting/Expenses/expensesModel");
const Product = require("../models/productModel");
const PaymentHistory = require("../models/paymentHistoryModel");

const GROUP_1 = "group-1";
const GROUP_2 = "group-2";
const GROUP_3 = "group-3";
const GROUP_4 = "group-4";

const getCompanyId = (req, res) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    res.status(400).json({ message: "companyId is required" });
    return null;
  }

  return companyId;
};

const buildPartyHistoryBalanceStats = async ({
  companyId,
  role,
  PartyModel,
  partyMatch,
  nameField,
}) => {
  const idField = role === "supplier" ? "supplierId" : "customerId";
  const activeParties = await PartyModel.find(partyMatch).select(`_id ${nameField}`).lean();
  const activePartyIds = new Set(activeParties.map((party) => String(party._id)));
  const partyNamesById = activeParties.reduce((acc, party) => {
    acc[String(party._id)] = party[nameField] || "";
    return acc;
  }, {});

  const partyBalances = await PaymentHistory.aggregate([
    {
      $match: {
        companyId,
        [idField]: { $exists: true, $nin: [null, ""] },
      },
    },
    {
      $addFields: {
        _amount: { $ifNull: ["$amountMainCurrency", 0] },
      },
    },
    {
      $addFields: {
        _balanceEffect: {
          $switch: {
            branches:
              role === "supplier"
                ? [
                    {
                      case: {
                        $and: [
                          { $eq: ["$entryType", "payment"] },
                          { $eq: ["$balanceEffectType", "Deposit"] },
                        ],
                      },
                      then: { $multiply: ["$_amount", -1] },
                    },
                    {
                      case: {
                        $and: [
                          { $eq: ["$entryType", "payment"] },
                          { $eq: ["$balanceEffectType", "Withdrawal"] },
                        ],
                      },
                      then: "$_amount",
                    },
                    {
                      case: {
                        $and: [
                          { $eq: ["$entryType", "invoice"] },
                          { $eq: ["$sourceModule", "purchase"] },
                          { $eq: ["$actionType", "create"] },
                        ],
                      },
                      then: "$_amount",
                    },
                    {
                      case: {
                        $and: [
                          { $eq: ["$entryType", "invoice"] },
                          { $eq: ["$sourceModule", "purchase"] },
                          { $in: ["$actionType", ["refund", "cancel", "update"]] },
                        ],
                      },
                      then: { $multiply: ["$_amount", -1] },
                    },
                    {
                      case: {
                        $and: [
                          { $eq: ["$entryType", "fx_adjustment"] },
                          { $eq: ["$balanceEffectType", "Withdrawal"] },
                        ],
                      },
                      then: "$_amount",
                    },
                    {
                      case: {
                        $and: [
                          { $eq: ["$entryType", "fx_adjustment"] },
                          { $eq: ["$balanceEffectType", "Deposit"] },
                        ],
                      },
                      then: { $multiply: ["$_amount", -1] },
                    },
                    {
                      case: {
                        $and: [
                          { $eq: ["$entryType", "expense"] },
                          { $eq: ["$sourceModule", "expense"] },
                          { $eq: ["$actionType", "create"] },
                        ],
                      },
                      then: "$_amount",
                    },
                    {
                      case: {
                        $and: [
                          { $eq: ["$entryType", "expense"] },
                          { $eq: ["$sourceModule", "expense"] },
                          { $in: ["$actionType", ["cancel", "update"]] },
                        ],
                      },
                      then: { $multiply: ["$_amount", -1] },
                    },
                    {
                      case: {
                        $and: [
                          { $eq: ["$entryType", "opening_balance"] },
                          { $eq: ["$balanceEffectType", "Deposit"] },
                        ],
                      },
                      then: { $multiply: ["$_amount", -1] },
                    },
                    {
                      case: {
                        $and: [
                          { $eq: ["$entryType", "opening_balance"] },
                          { $eq: ["$balanceEffectType", "Withdrawal"] },
                        ],
                      },
                      then: "$_amount",
                    },
                  ]
                : [
                    {
                      case: {
                        $and: [
                          { $eq: ["$entryType", "payment"] },
                          { $eq: ["$balanceEffectType", "Deposit"] },
                        ],
                      },
                      then: "$_amount",
                    },
                    {
                      case: {
                        $and: [
                          { $eq: ["$entryType", "payment"] },
                          { $eq: ["$balanceEffectType", "Withdrawal"] },
                        ],
                      },
                      then: { $multiply: ["$_amount", -1] },
                    },
                    {
                      case: {
                        $and: [
                          { $eq: ["$entryType", "invoice"] },
                          { $eq: ["$sourceModule", "sales"] },
                          { $eq: ["$actionType", "create"] },
                        ],
                      },
                      then: "$_amount",
                    },
                    {
                      case: {
                        $and: [
                          { $eq: ["$entryType", "invoice"] },
                          { $eq: ["$sourceModule", "sales"] },
                          { $in: ["$actionType", ["refund", "cancel", "update"]] },
                        ],
                      },
                      then: { $multiply: ["$_amount", -1] },
                    },
                    {
                      case: {
                        $and: [
                          { $eq: ["$entryType", "fx_adjustment"] },
                          { $eq: ["$balanceEffectType", "Withdrawal"] },
                        ],
                      },
                      then: { $multiply: ["$_amount", -1] },
                    },
                    {
                      case: {
                        $and: [
                          { $eq: ["$entryType", "fx_adjustment"] },
                          { $eq: ["$balanceEffectType", "Deposit"] },
                        ],
                      },
                      then: "$_amount",
                    },
                    {
                      case: {
                        $and: [
                          { $eq: ["$entryType", "opening_balance"] },
                          { $eq: ["$balanceEffectType", "Deposit"] },
                        ],
                      },
                      then: "$_amount",
                    },
                    {
                      case: {
                        $and: [
                          { $eq: ["$entryType", "opening_balance"] },
                          { $eq: ["$balanceEffectType", "Withdrawal"] },
                        ],
                      },
                      then: { $multiply: ["$_amount", -1] },
                    },
                  ],
            default: 0,
          },
        },
      },
    },
    {
      $group: {
        _id: `$${idField}`,
        balance: { $sum: "$_balanceEffect" },
      },
    },
  ]);

  const positiveBalances = partyBalances
    .filter((item) => activePartyIds.has(String(item._id)) && item.balance > 0)
    .map((item) => ({
      id: String(item._id),
      name: partyNamesById[String(item._id)] || "",
      amount: Number(item.balance || 0),
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    totalCount: activeParties.length,
    debtCount: positiveBalances.length,
    debtAmount: positiveBalances.reduce((sum, item) => sum + item.amount, 0),
    topDebtors: positiveBalances.slice(0, 3),
  };
};

const buildGroup1SnapshotPayload = async (companyId) => {
  const [suppliers, customers] = await Promise.all([
    buildPartyHistoryBalanceStats({
      companyId,
      role: "supplier",
      PartyModel: Supplier,
      partyMatch: { companyId, archives: { $ne: "true" } },
      nameField: "supplierName",
    }),
    buildPartyHistoryBalanceStats({
      companyId,
      role: "customer",
      PartyModel: Customer,
      partyMatch: { companyId, archives: { $ne: true } },
      nameField: "name",
    }),
  ]);

  return {
    suppliers,
    customers,
    generatedAt: new Date(),
  };
};

const buildGroup2SnapshotPayload = async (companyId) => {
  const [result] = await FinancialFund.aggregate([
    { $match: { companyId } },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              totalAccounts: { $sum: 1 },
              cashAccounts: {
                $sum: { $cond: [{ $eq: ["$type", "Fund"] }, 1, 0] },
              },
              bankAccounts: {
                $sum: { $cond: [{ $eq: ["$type", "Bank"] }, 1, 0] },
              },
              totalBalance: { $sum: { $ifNull: ["$fundBalance", 0] } },
              cashBalance: {
                $sum: {
                  $cond: [
                    { $eq: ["$type", "Fund"] },
                    { $ifNull: ["$fundBalance", 0] },
                    0,
                  ],
                },
              },
              bankBalance: {
                $sum: {
                  $cond: [
                    { $eq: ["$type", "Bank"] },
                    { $ifNull: ["$fundBalance", 0] },
                    0,
                  ],
                },
              },
              positiveAccounts: {
                $sum: {
                  $cond: [{ $gt: [{ $ifNull: ["$fundBalance", 0] }, 0] }, 1, 0],
                },
              },
              overdrawnAccounts: {
                $sum: {
                  $cond: [{ $lt: [{ $ifNull: ["$fundBalance", 0] }, 0] }, 1, 0],
                },
              },
            },
          },
        ],
        topAccounts: [
          {
            $project: {
              _id: 1,
              name: "$fundName",
              type: 1,
              balance: { $ifNull: ["$fundBalance", 0] },
            },
          },
          { $sort: { balance: -1 } },
          { $limit: 3 },
        ],
      },
    },
  ]);
  const stats = result?.totals?.[0] || {};
  const topAccounts = result?.topAccounts || [];

  return {
    cash: {
      totalAccounts: stats?.totalAccounts || 0,
      cashAccounts: stats?.cashAccounts || 0,
      bankAccounts: stats?.bankAccounts || 0,
      totalBalance: stats?.totalBalance || 0,
      cashBalance: stats?.cashBalance || 0,
      bankBalance: stats?.bankBalance || 0,
      positiveAccounts: stats?.positiveAccounts || 0,
      overdrawnAccounts: stats?.overdrawnAccounts || 0,
      topAccounts: topAccounts.map((item) => ({
        id: String(item._id),
        name: item.name || "",
        type: item.type || "",
        balance: item.balance || 0,
      })),
    },
    generatedAt: new Date(),
  };
};

const buildDocumentPaymentStats = async ({
  Model,
  match,
  paymentStatusField,
  totalField,
  remainderField,
}) => {
  const [stats] = await Model.aggregate([
    { $match: match },
    {
      $addFields: {
        _dashboardTotal: { $ifNull: [`$${totalField}`, 0] },
        _dashboardRemainder: { $ifNull: [`$${remainderField}`, 0] },
        _dashboardPaymentsCount: {
          $size: { $ifNull: ["$payments", []] },
        },
      },
    },
    {
      $addFields: {
        _isPaid: {
          $or: [
            { $eq: [`$${paymentStatusField}`, "paid"] },
            { $lte: ["$_dashboardRemainder", 0.9] },
          ],
        },
        _isPartial: {
          $and: [
            { $ne: [`$${paymentStatusField}`, "paid"] },
            { $gt: ["$_dashboardRemainder", 0.9] },
            {
              $or: [
                { $gt: ["$_dashboardPaymentsCount", 0] },
                { $lt: ["$_dashboardRemainder", "$_dashboardTotal"] },
              ],
            },
          ],
        },
      },
    },
    {
      $group: {
        _id: null,
        totalCount: { $sum: 1 },
        paidCount: { $sum: { $cond: ["$_isPaid", 1, 0] } },
        partiallyPaidCount: { $sum: { $cond: ["$_isPartial", 1, 0] } },
        unpaidCount: {
          $sum: {
            $cond: [
              { $and: [{ $not: ["$_isPaid"] }, { $not: ["$_isPartial"] }] },
              1,
              0,
            ],
          },
        },
        totalAmount: { $sum: "$_dashboardTotal" },
        outstandingAmount: { $sum: "$_dashboardRemainder" },
      },
    },
  ]);

  return {
    totalCount: stats?.totalCount || 0,
    paidCount: stats?.paidCount || 0,
    unpaidCount: stats?.unpaidCount || 0,
    partiallyPaidCount: stats?.partiallyPaidCount || 0,
    totalAmount: stats?.totalAmount || 0,
    outstandingAmount: stats?.outstandingAmount || 0,
  };
};

const buildGroup3SnapshotPayload = async (companyId) => {
  const [salesInvoices, purchaseInvoices, expenses] = await Promise.all([
    buildDocumentPaymentStats({
      Model: SalesInvoice,
      match: {
        companyId,
        archives: { $ne: true },
        status: { $ne: "cancelled" },
      },
      paymentStatusField: "paymentsStatus",
      totalField: "totalInMainCurrency",
      remainderField: "totalRemainderMainCurrency",
    }),
    buildDocumentPaymentStats({
      Model: PurchaseInvoice,
      match: {
        companyId,
        archives: { $ne: true },
        status: { $ne: "cancelled" },
      },
      paymentStatusField: "paid",
      totalField: "totalPurchasePriceMainCurrency",
      remainderField: "totalRemainderMainCurrency",
    }),
    buildDocumentPaymentStats({
      Model: Expense,
      match: { companyId, status: { $ne: "cancelled" } },
      paymentStatusField: "paymentStatus",
      totalField: "expenceTotalMainCurrency",
      remainderField: "totalRemainderMainCurrency",
    }),
  ]);

  return {
    salesInvoices,
    purchaseInvoices,
    expenses,
    generatedAt: new Date(),
  };
};

const PRODUCT_TYPES = ["Normal", "Service", "rawmaterial", "manufactured"];

const buildGroup4SnapshotPayload = async (companyId) => {
  const [stats] = await Product.aggregate([
    {
      $match: {
        companyId,
        archives: { $ne: "true" },
      },
    },
    {
      $addFields: {
        _stockRows: {
          $map: {
            input: { $ifNull: ["$stocks", []] },
            as: "stock",
            in: {
              quantity: {
                $convert: {
                  input: "$$stock.productQuantity",
                  to: "double",
                  onError: 0,
                  onNull: 0,
                },
              },
              minimum: {
                $convert: {
                  input: "$$stock.minimum",
                  to: "double",
                  onError: 0,
                  onNull: 0,
                },
              },
              maximum: {
                $convert: {
                  input: "$$stock.maximum",
                  to: "double",
                  onError: 0,
                  onNull: 0,
                },
              },
            },
          },
        },
        _quantity: {
          $sum: {
            $map: {
              input: { $ifNull: ["$stocks", []] },
              as: "stock",
              in: {
                $convert: {
                  input: "$$stock.productQuantity",
                  to: "double",
                  onError: 0,
                  onNull: 0,
                },
              },
            },
          },
        },
        _cost: {
          $convert: {
            input: {
              $ifNull: ["$costBuyingPrice", { $ifNull: ["$buyingprice", 0] }],
            },
            to: "double",
            onError: 0,
            onNull: 0,
          },
        },
        _sellingPrice: {
          $convert: {
            input: "$price",
            to: "double",
            onError: 0,
            onNull: 0,
          },
        },
        _variantsCount: { $size: { $ifNull: ["$variants", []] } },
      },
    },
    {
      $addFields: {
        _minimumQuantity: { $sum: "$_stockRows.minimum" },
        _isLowStock: {
          $gt: [
            {
              $size: {
                $filter: {
                  input: "$_stockRows",
                  as: "stock",
                  cond: {
                    $and: [
                      { $gt: ["$$stock.minimum", 0] },
                      { $gt: ["$$stock.quantity", 0] },
                      { $lte: ["$$stock.quantity", "$$stock.minimum"] },
                    ],
                  },
                },
              },
            },
            0,
          ],
        },
      },
    },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              totalProducts: { $sum: 1 },
              totalQuantity: { $sum: "$_quantity" },
              stockValue: {
                $sum: { $multiply: ["$_quantity", "$_cost"] },
              },
              salesValue: {
                $sum: { $multiply: ["$_quantity", "$_sellingPrice"] },
              },
              expectedProfit: {
                $sum: {
                  $multiply: [
                    "$_quantity",
                    { $subtract: ["$_sellingPrice", "$_cost"] },
                  ],
                },
              },
              minimumQuantity: { $sum: "$_minimumQuantity" },
              lowStockItems: {
                $sum: { $cond: ["$_isLowStock", 1, 0] },
              },
              outOfStockItems: {
                $sum: { $cond: [{ $lte: ["$_quantity", 0] }, 1, 0] },
              },
              variantsCount: { $sum: "$_variantsCount" },
            },
          },
        ],

        types: [
          {
            $group: {
              _id: "$type",
              count: { $sum: 1 },
              quantity: { $sum: "$_quantity" },
              stockValue: {
                $sum: { $multiply: ["$_quantity", "$_cost"] },
              },
              salesValue: {
                $sum: { $multiply: ["$_quantity", "$_sellingPrice"] },
              },
              lowStockItems: {
                $sum: { $cond: ["$_isLowStock", 1, 0] },
              },
              outOfStockItems: {
                $sum: { $cond: [{ $lte: ["$_quantity", 0] }, 1, 0] },
              },
            },
          },
        ],
      },
    },
    {
      $project: {
        totals: { $arrayElemAt: ["$totals", 0] },
        types: 1,
      },
    },
  ]);

  const totals = stats?.totals || {};

  const typeMetrics = PRODUCT_TYPES.reduce((acc, type) => {
    acc[type] = {
      count: 0,
      quantity: 0,
      stockValue: 0,
      salesValue: 0,
      lowStockItems: 0,
      outOfStockItems: 0,
    };
    return acc;
  }, {});

  for (const item of stats?.types || []) {
    if (!typeMetrics[item._id]) continue;

    typeMetrics[item._id] = {
      count: item.count || 0,
      quantity: item.quantity || 0,
      stockValue: item.stockValue || 0,
      salesValue: item.salesValue || 0,
      lowStockItems: item.lowStockItems || 0,
      outOfStockItems: item.outOfStockItems || 0,
    };
  }

  return {
    products: {
      totalProducts: totals.totalProducts || 0,
      totalQuantity: totals.totalQuantity || 0,
      stockValue: totals.stockValue || 0,
      salesValue: totals.salesValue || 0,
      expectedProfit: totals.expectedProfit || 0,
      minimumQuantity: totals.minimumQuantity || 0,
      lowStockItems: totals.lowStockItems || 0,
      outOfStockItems: totals.outOfStockItems || 0,
      variantsCount: totals.variantsCount || 0,

      normalItems: typeMetrics.Normal.count,
      serviceItems: typeMetrics.Service.count,
      rawMaterialItems: typeMetrics.rawmaterial.count,
      manufacturedItems: typeMetrics.manufactured.count,

      typeMetrics,
    },
    generatedAt: new Date(),
  };
};

const groupBuilders = {
  [GROUP_1]: buildGroup1SnapshotPayload,
  [GROUP_2]: buildGroup2SnapshotPayload,
  [GROUP_3]: buildGroup3SnapshotPayload,
  [GROUP_4]: buildGroup4SnapshotPayload,
};

const refreshSnapshot = async ({ companyId, group, payload }) => {
  return DashboardStatsSnapshot.findOneAndUpdate(
    { companyId, group },
    {
      companyId,
      group,
      payload,
      generatedAt: payload.generatedAt,
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
};

const ensureGroup1Snapshot = async (companyId) => {
  return ensureSnapshot(companyId, GROUP_1);
};

const ensureSnapshot = async (companyId, group) => {
  const existing = await DashboardStatsSnapshot.findOne({
    companyId,
    group,
  }).lean();

  if (existing) {
    return existing;
  }

  const payload = await groupBuilders[group](companyId);
  return refreshSnapshot({ companyId, group, payload });
};

const getDashboardStats = (group) =>
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req, res);
    if (!companyId) return;

    const snapshot = await ensureSnapshot(companyId, group);

    res.status(200).json({
      status: "true",
      data: snapshot.payload,
      generatedAt: snapshot.generatedAt,
    });
  });

const refreshDashboardStats = (group) =>
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req, res);
    if (!companyId) return;

    const payload = await groupBuilders[group](companyId);
    const snapshot = await refreshSnapshot({ companyId, group, payload });

    res.status(200).json({
      status: "true",
      message: `Dashboard ${group} stats refreshed`,
      data: snapshot.payload,
      generatedAt: snapshot.generatedAt,
    });
  });

exports.getDashboardGroup1Stats = getDashboardStats(GROUP_1);
exports.refreshDashboardGroup1Stats = refreshDashboardStats(GROUP_1);
exports.getDashboardGroup2Stats = getDashboardStats(GROUP_2);
exports.refreshDashboardGroup2Stats = refreshDashboardStats(GROUP_2);
exports.getDashboardGroup3Stats = getDashboardStats(GROUP_3);
exports.refreshDashboardGroup3Stats = refreshDashboardStats(GROUP_3);
exports.getDashboardGroup4Stats = getDashboardStats(GROUP_4);
exports.refreshDashboardGroup4Stats = refreshDashboardStats(GROUP_4);

exports.getDashboardAllStats = asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req, res);
  if (!companyId) return;

  const [group1, group2, group3, group4] = await Promise.all([
    ensureGroup1Snapshot(companyId),
    ensureSnapshot(companyId, GROUP_2),
    ensureSnapshot(companyId, GROUP_3),
    ensureSnapshot(companyId, GROUP_4),
  ]);

  res.status(200).json({
    status: "true",
    data: {
      group1: group1.payload,
      group2: group2.payload,
      group3: group3.payload,
      group4: group4.payload,
    },
  });
});
