const asyncHandler = require("express-async-handler");
const accountingTreeModel = require("../../models/accountingTreeModel");
const journalEntryModel = require("../../models/Accounting/JournalEntries/journalEntries.model");

exports.getIncomeStatement = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const companyId = req.companyId;

  const accounts = await accountingTreeModel
    .find({ companyId })
    .sort({ code: 1 })
    .lean();

  const accountsMap = {};
  accounts.forEach((acc) => {
    if (!acc || !acc._id) return;
    accountsMap[acc._id.toString()] = { ...acc, children: [] };
  });

  const rootAccounts = [];
  accounts.forEach((acc) => {
    if (!acc || !acc._id) return;

    rootAccounts.push(accountsMap[acc._id.toString()]);
  });

  const journalEntries = await journalEntryModel.aggregate([
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
      $group: {
        _id: "$journalAccounts.id",
        totalDebit: { $sum: "$journalAccounts.MainDebit" },
        totalCredit: { $sum: "$journalAccounts.MainCredit" },
      },
    },
  ]);

  const balancesMap = {};
  journalEntries.forEach((e) => {
    if (!e || !e._id) return;
    balancesMap[e._id.toString()] = (e.totalDebit || 0) - (e.totalCredit || 0);
  });

  const calculateTreeBalances = (account) => {
    if (!account || !account._id) {
      return {
        _id: null,
        name: "Unknown",
        balance: 0,
        totalBalance: 0,
        parentId: null,
      };
    }

    const balance = balancesMap[account._id.toString()] || 0;

    let finalBalance = balance;
    if (account.balanceType === "credit") {
      finalBalance = -finalBalance;
    }

    return {
      _id: account._id,
      code: account.code,
      name: account.name,
      balanceType: account.balanceType,
      balance,
      totalBalance: finalBalance,
      parentId: account.parentId,
      parentCode: account.parentCode,
      accountCategory: account.accountCategory,
      accountType: account.accountType,
    };
  };

  const incomeSections = [
    "revenue",
    "contraRevenue",
    "costOfGoodsSold",
    "operatingExpenses",
    "nonOperatingExpenses",
    "nonOperatingIncome",
    "nonOperatingExpenses/income",
    "nonOperatingExpensesTax",
    "intercompanyAndRelatedPartyIncomeAndExpense",
    "intercompanyAndRelatedPartyExpenses",
    "intercompanyAndRelatedPartyIncome",
  ];

  const report = {};

  for (const section of incomeSections) {
    const mainAccounts = rootAccounts.filter(
      (acc) =>
        acc.accountType &&
        acc.accountType.toLowerCase() === section.toLowerCase(),
    );

    const sectionData = mainAccounts.map(calculateTreeBalances);
    const sectionTotal = sectionData.reduce(
      (sum, acc) => sum + (acc.totalBalance || 0),
      0,
    );

    report[section] = { total: sectionTotal, accounts: sectionData };
  }

  const totalIncome =
    (report.Revenue?.total || 0) +
    (report["Contra-Revenue"]?.total || 0) -
    (report["Cost of Good Sold"]?.total || 0) -
    (report["Operating Expenses"]?.total || 0) -
    (report["Non Operating Expenses"]?.total || 0) -
    (report["Non Operating Expenses - Tax"]?.total || 0) +
    (report["Intercompany and related party liabilities"]?.total || 0) +
    (report["Non Operating income"]?.total || 0);

  res.status(200).json({
    companyId,
    startDate,
    endDate,
    report,
    netIncome: totalIncome,
  });
});
