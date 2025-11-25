const asyncHandler = require("express-async-handler");
const financialFundsModel = require("../../models/financialFundsModel");
const accountingTreeModel = require("../../models/accountingTreeModel");
const journalEntryModel = require("../../models/journalEntryModel");

exports.CashFlowReports = asyncHandler(async (req, res) => {
  const { companyId, startDate, endDate } = req.query;

  // جلب الحسابات النقدية
  const cashAccounts = await accountingTreeModel
    .find({
      companyId,
      _id: {
        $in: (
          await financialFundsModel.find({ companyId }).lean()
        ).map((fund) => fund.linkAccount),
      },
    })
    .sort({ code: 1 })
    .lean();

  // جلب باقي الحسابات
  const otherAccounts = await accountingTreeModel
    .find({
      companyId,
      accountType: {
        $in: [
          "Operating Expenses",
          "Non Operating Expenses",
          "Current Asset",
          "Current Liabilities",
        ],
      },
      _id: { $nin: cashAccounts.map((acc) => acc._id) },
    })
    .lean();

  const allAccounts = [...cashAccounts, ...otherAccounts];
  const accountsMap = {};
  allAccounts.forEach((acc) => {
    accountsMap[acc._id.toString()] = acc;
  });

  const targetIds = allAccounts.map((a) => a._id.toString());

  // تجميع الحركات اليومية لكل حساب
  const journalAggregates = await journalEntryModel.aggregate([
    {
      $match: {
        companyId,
        ...(startDate && endDate
          ? {
              journalDate: {
                $gte: `${startDate}T00:00:00.000Z`,
                $lte: `${endDate}T23:59:59.999Z`,
              },
            }
          : {}),
      },
    },
    { $unwind: "$journalAccounts" },
    {
      $match: {
        "journalAccounts.id": { $in: targetIds },
      },
    },
    {
      $group: {
        _id: "$journalAccounts.id",
        totalDebit: { $sum: "$journalAccounts.MainDebit" },
        totalCredit: { $sum: "$journalAccounts.MainCredit" },
      },
    },
  ]);

  const balancesMap = {};
  journalAggregates.forEach((entry) => {
    balancesMap[entry._id.toString()] =
      (entry.totalDebit || 0) - (entry.totalCredit || 0);
  });

  const calculateAccountBalance = (acc) => {
    const balance = balancesMap[acc._id.toString()] || 0;
    return acc.balanceType === "credit" ? -balance : balance;
  };

  // تجهيز تقرير cashAccounts فقط
  const cashReport = cashAccounts.map((acc) => ({
    _id: acc._id,
    name: acc.name,
    balance: calculateAccountBalance(acc),
  }));

  // تقرير باقي الحسابات حسب النوع
  const otherSections = [
    "Operating Expenses",
    "Non Operating Expenses",
    "Current Asset",
    "Current Liabilities",
  ];
  const otherReport = {};

  otherSections.forEach((section) => {
    const sectionAccounts = otherAccounts.filter(
      (acc) => acc.accountType === section
    );
    const sectionData = sectionAccounts.map((acc) => ({
      _id: acc._id,
      name: acc.name,
      balance: calculateAccountBalance(acc),
    }));
    const sectionTotal = sectionData.reduce((sum, acc) => sum + acc.balance, 0);
    otherReport[section] = { total: sectionTotal, accounts: sectionData };
  });

  res.status(200).json({
    companyId,
    startDate,
    endDate,
    cashReport,
    otherReport,
  });
});
