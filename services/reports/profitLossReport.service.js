const salesModel = require("../../models/Accounting/Sales/orderModel");
const expensesModel = require("../../models/Accounting/Expenses/expensesModel");
const {
  getSalesReportService,
  buildSalesMatch,
  invoiceNormalize,
  POSTED_MATCH,
} = require("./salesReport.service");
const { getExpensesReportService } = require("./expensesReport.service");
const { toNum, buildBaseMatch } = require("./reportHelpers");

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const pct = (part, total) => (total ? r2((part / total) * 100) : 0);

// all YYYY-MM keys between two YYYY-MM-DD dates (inclusive)
const monthKeysBetween = (startDate, endDate) => {
  const keys = [];
  let [y, m] = startDate.slice(0, 7).split("-").map(Number);
  const [ey, em] = endDate.slice(0, 7).split("-").map(Number);

  while (y < ey || (y === ey && m <= em)) {
    keys.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return keys;
};

// ── Monthly: sales (net revenue + cost), same rules as sales report ──
const salesMonthly = ({ companyId, startDate, endDate }) =>
  salesModel.aggregate([
    {
      $match: {
        ...buildSalesMatch({ companyId, startDate, endDate }),
        ...POSTED_MATCH,
      },
    },
    ...invoiceNormalize(false),
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m", date: "$orderDate" } },
        revenue: { $sum: "$netMain" },
        cost: { $sum: "$costMain" },
      },
    },
  ]);

// ── Monthly: expenses (net of tax), same rules as expenses report ──
// expenceTotalMainCurrency is tax-inclusive → net = gross − tax
const expensesMonthly = ({ companyId, startDate, endDate }) =>
  expensesModel.aggregate([
    { $match: buildBaseMatch({ companyId, startDate, endDate }) },
    {
      $addFields: {
        _gross: toNum("$expenceTotalMainCurrency"),
        _tax: {
          $cond: [
            { $gt: [{ $size: { $ifNull: ["$taxDetails", []] } }, 0] },
            { $sum: "$taxDetails.amountMain" },
            toNum("$mainCurrencyTax"),
          ],
        },
      },
    },
    {
      $group: {
        _id: { $substrBytes: ["$date", 0, 7] },
        expenses: { $sum: { $subtract: ["$_gross", "$_tax"] } },
      },
    },
  ]);

exports.getProfitLossReportService = async ({ req, companyId }) => {
  const { startDate, endDate } = req.query;

  // P&L is always excl. tax
  const subReq = (sections) => ({
    query: { startDate, endDate, includeTax: "false", sections },
  });

  const [sales, expenses, salesByMonth, expensesByMonth] = await Promise.all([
    getSalesReportService({ req: subReq("summary,byCategory"), companyId }),
    getExpensesReportService({ req: subReq("summary,byCategory"), companyId }),
    salesMonthly({ companyId, startDate, endDate }),
    expensesMonthly({ companyId, startDate, endDate }),
  ]);

  // ── Summary ───────────────────────────────────────────────────
  const revenue = sales.summary.net;
  const cost = sales.summary.cost;
  const grossProfit = revenue - cost;
  const expensesNet = expenses.summary.net;
  const netProfit = grossProfit - expensesNet;

  const summary = {
    revenue: r2(revenue),
    cost: r2(cost),
    grossProfit: r2(grossProfit),
    grossMargin: pct(grossProfit, revenue),
    expenses: r2(expensesNet),
    netProfit: r2(netProfit),
    netMargin: pct(netProfit, revenue),
    invoicesCount: sales.summary.count,
    expensesCount: expenses.summary.count,
  };

  // ── Monthly (zero-filled across the whole range) ───────────────
  const salesMap = new Map(salesByMonth.map((m) => [m._id, m]));
  const expensesMap = new Map(expensesByMonth.map((m) => [m._id, m]));

  const keys =
    startDate && endDate
      ? monthKeysBetween(startDate, endDate)
      : [...new Set([...salesMap.keys(), ...expensesMap.keys()])]
          .filter(Boolean)
          .sort();

  const monthly = keys.map((month) => {
    const mRevenue = salesMap.get(month)?.revenue || 0;
    const mCost = salesMap.get(month)?.cost || 0;
    const mExpenses = expensesMap.get(month)?.expenses || 0;
    const mGross = mRevenue - mCost;

    return {
      month,
      revenue: r2(mRevenue),
      cost: r2(mCost),
      grossProfit: r2(mGross),
      expenses: r2(mExpenses),
      netProfit: r2(mGross - mExpenses),
    };
  });

  return {
    filters: { startDate, endDate },
    summary,
    monthly,
    revenueByCategory: sales.byCategory || [], // amount = net, plus cost & profit
    expensesByCategory: expenses.byCategory || [], // amount = net
  };
};
