const asyncHandler = require("express-async-handler");
const accountingTreeModel = require("../../models/accountingTreeModel");
const journalEntryModel = require("../../models/journalEntryModel");

exports.getIncomeStatement = asyncHandler(async (req, res) => {
  const { companyId, startDate, endDate } = req.query;

  const accounts = await accountingTreeModel
    .find({ companyId }, { name: 1, code: 1, accountType: 1, balanceType: 1 })
    .sort({ code: 1 })
    .lean();

  const accountsMap = new Map(accounts.map((a) => [a._id.toString(), a]));

  const matchStage = {
    companyId,
  };

  if (startDate && endDate) {
    matchStage.journalDate = {
      $gte: new Date(`${startDate}T00:00:00.000Z`),
      $lte: new Date(`${endDate}T23:59:59.999Z`),
    };
  }

  const journalEntries = await journalEntryModel.aggregate([
    { $match: matchStage },
    { $unwind: "$journalAccounts" },
    {
      $group: {
        _id: "$journalAccounts.id",
        totalDebit: { $sum: "$journalAccounts.MainDebit" },
        totalCredit: { $sum: "$journalAccounts.MainCredit" },
      },
    },
  ]);

  const balancesMap = new Map();
  journalEntries.forEach((e) => {
    const net = (e.totalDebit || 0) - (e.totalCredit || 0);
    balancesMap.set(e._id.toString(), net);
  });

  const calculateBalance = (account) => {
    const raw = balancesMap.get(account._id.toString()) || 0;
    const finalBalance = account.balanceType === "credit" ? -raw : raw;

    return {
      _id: account._id,
      code: account.code,
      name: account.name,
      balanceType: account.balanceType,
      balance: raw,
      totalBalance: finalBalance,
      accountType: account.accountType,
    };
  };

  const incomeSections = [
    "Revenue",
    "Contra-Revenue",
    "Cost of Good Sold",
    "Operating Expenses",
    "Non Operating Expenses",
    "Non Operating income",
  ];

  const report = {};

  incomeSections.forEach((section) => {
    const sectionAccounts = accounts.filter(
      (acc) =>
        acc.accountType &&
        acc.accountType.toLowerCase() === section.toLowerCase()
    );

    const sectionData = sectionAccounts.map(calculateBalance);

    const total = sectionData.reduce((sum, a) => sum + a.totalBalance, 0);

    report[section] = {
      total,
      accounts: sectionData,
    };
  });

  const netIncome =
    (report.Revenue?.total || 0) +
    (report["Contra-Revenue"]?.total || 0) -
    (report["Cost of Good Sold"]?.total || 0) -
    (report["Operating Expenses"]?.total || 0) -
    (report["Non Operating Expenses"]?.total || 0) +
    (report["Non Operating income"]?.total || 0);

  res.status(200).json({
    companyId,
    startDate,
    endDate,
    report,
    netIncome,
  });
});
