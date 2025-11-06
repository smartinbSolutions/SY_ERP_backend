const asyncHandler = require("express-async-handler");
const accountingTreeModel = require("../../models/accountingTreeModel");
const journalEntryModel = require("../../models/journalEntryModel");

exports.getFinancialReport = asyncHandler(async (req, res, next) => {
  const { companyId, startDate, endDate } = req.query;

  const accounts = await accountingTreeModel.find({ companyId }).lean();

  const accountsMap = {};
  accounts.forEach((acc) => {
    accountsMap[acc._id.toString()] = { ...acc, children: [] };
  });

  const rootAccounts = [];
  accounts.forEach((acc) => {
    if (acc.parentId) {
      const parent = accountsMap[acc.parentId];
      if (parent) parent.children.push(accountsMap[acc._id.toString()]);
    } else {
      rootAccounts.push(accountsMap[acc._id.toString()]);
    }
  });

  const getAccountBalance = async (accountId, isCreditPositive = false) => {
    const result = await journalEntryModel.aggregate([
      {
        $match: {
          companyId,
          "journalAccounts.id": accountId.toString(),
        },
      },
      { $unwind: "$journalAccounts" },
      { $match: { "journalAccounts.id": accountId.toString() } },
      {
        $group: {
          _id: null,
          totalDebit: { $sum: "$journalAccounts.accountDebit" },
          totalCredit: { $sum: "$journalAccounts.accountCredit" },
        },
      },
    ]);
    if (result.length === 0) return 0;
    const { totalDebit, totalCredit } = result[0];
    return isCreditPositive
      ? totalCredit - totalDebit
      : totalDebit - totalCredit;
  };

  const calculateTreeBalances = async (account, isCreditPositive) => {
    const balance = await getAccountBalance(account._id, isCreditPositive);

    let childrenBalances = [];
    let totalChildrenBalance = 0;
    for (const child of account.children) {
      const childResult = await calculateTreeBalances(child, isCreditPositive);
      childrenBalances.push(childResult);
      totalChildrenBalance += childResult.totalBalance;
    }

    const totalBalance = balance + totalChildrenBalance;

    return {
      _id: account._id,
      code: account.code,
      name: account.name,
      accountType: account.accountType,
      finalAccount: account.finalAccount,
      balance,
      totalBalance,
      children: childrenBalances,
    };
  };

  const sections = [
    "currentAssest",
    "fixedAsset",
    "currentLiabilities",
    "otherCurrentLiability",
    "equity",
    "income",
    "costOfGoodsSold",
    "expense",
    "otherExpense",
  ];

  const report = {};

  for (const section of sections) {
    const mainAccounts = rootAccounts.filter(
      (acc) => acc.accountType?.toLowerCase() === section.toLowerCase()
    );

    const sectionData = [];
    for (const acc of mainAccounts) {
      const data = await calculateTreeBalances(
        acc,
        [
          "income",
          "equity",
          "currentLiabilities",
          "otherCurrentLiability",
        ].includes(section.toLowerCase())
      );
      sectionData.push(data);
    }

    const sectionTotal = sectionData.reduce(
      (sum, acc) => sum + acc.totalBalance,
      0
    );

    report[section] = { total: sectionTotal, accounts: sectionData };
  }

  res.status(200).json(report);
});
