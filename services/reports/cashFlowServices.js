const asyncHandler = require("express-async-handler");
const financialFundsModel = require("../../models/financialFundsModel");
const accountingTreeModel = require("../../models/accountingTreeModel");
const journalEntryModel = require("../../models/journalEntryModel");

exports.CashFlowReports = asyncHandler(async (req, res) => {
  const { companyId, startDate, endDate } = req.query;

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
      accountCategory: "operating",
      _id: { $nin: cashAccounts.map((acc) => acc._id) },
    })
    .lean();
  const fixedAccounts = await accountingTreeModel
    .find({
      companyId,
      accountType: {
        $in: ["Fixed Assets"],
      },
      accountCategory: "investing",
    })
    .lean();
  const financingAccounts = await accountingTreeModel
    .find({
      companyId,
      accountType: {
        $in: ["Non-Current Liabilities", "Equity", "Current Asset"],
      },
      accountCategory: "financing",
    })
    .lean();
  const allAccounts = [
    ...cashAccounts,
    ...otherAccounts,
    ...fixedAccounts,
    ...financingAccounts,
  ];
  const accountsMap = {};
  allAccounts.forEach((acc) => {
    accountsMap[acc._id.toString()] = acc;
  });

  const targetIds = allAccounts.map((a) => a._id.toString());

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

  const cashReport = cashAccounts.map((acc) => ({
    _id: acc._id,
    name: acc.name,
    balanceType: acc.balanceType,
    balance: calculateAccountBalance(acc),
  }));

  const otherSections = [
    "Current Asset",
    "Current Liabilities",
    "Operating Expenses",
    "Non Operating Expenses",
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
  const fixedReport = fixedAccounts.map((acc) => ({
    _id: acc._id,
    name: acc.name,
    balance: calculateAccountBalance(acc),
  }));

  const investingReport = financingAccounts.map((acc) => ({
    _id: acc._id,
    name: acc.name,
    balance: calculateAccountBalance(acc),
  }));

  res.status(200).json({
    companyId,
    startDate,
    endDate,
    cashReport,
    otherReport,
    investingReport,
    fixedReport,
  });
});
