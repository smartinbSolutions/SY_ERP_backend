const asyncHandler = require("express-async-handler");
const financialFundsModel = require("../../models/Accounting/CurrentAssets/financialFundsModel");
const accountingTreeModel = require("../../models/accountingTreeModel");
const journalEntryModel = require("../../models/journalEntryModel");

exports.CashFlowReports = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const companyId = req.companyId;

  /* get All Cash Accounts */
  const cashAccounts = await accountingTreeModel
    .find({
      companyId,
      _id: {
        $in: (await financialFundsModel.find({ companyId }).lean()).map(
          (fund) => fund.linkAccount,
        ),
      },
    })
    .sort({ code: 1 })
    .lean();
  /* get operating , investing , financing  Accounts */
  const operatingAccounts = await accountingTreeModel
    .find({
      companyId,
      accountType: {
        $in: [
          "operatingExpenses",
          "nonOperatingExpenses",
          "currentAsset",
          "currentLiabilities",
        ],
      },
      accountCategory: "operating",
      _id: { $nin: cashAccounts.map((acc) => acc._id) },
    })
    .lean();

  const investingAccounts = await accountingTreeModel
    .find({
      companyId,
      accountType: ["fixedAsset"],
      accountCategory: "investing",
    })
    .lean();

  const financingAccounts = await accountingTreeModel
    .find({
      companyId,
      accountType: ["nonCurrentLiabilities", "equity", "currentAsset"],
      accountCategory: "financing",
    })
    .lean();

  /* merge Accounts into one Array */
  const allAccounts = [
    ...cashAccounts,
    ...operatingAccounts,
    ...investingAccounts,
    ...financingAccounts,
  ];
  /*get Accounts Ids*/
  const targetIds = allAccounts.map((a) => a._id.toString());

  const userStart = `${startDate}T00:00:00.000Z`;
  const userEnd = `${endDate}T23:59:59.999Z`;
  const yearStart = `${startDate.split("-")[0]}-01-01T00:00:00.000Z`;
  const prevEnd = `${startDate}T00:00:00.000Z`;

  /*get All entries fo the accounts array*/
  async function getPeriodBalances(start, end) {
    const result = await journalEntryModel.aggregate([
      { $match: { companyId } },

      {
        $match: {
          journalDate: {
            $gte: start,
            $lte: end,
          },
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

    const map = {};
    result.forEach((r) => {
      map[r._id] = (r.totalDebit || 0) - (r.totalCredit || 0);
    });

    return map;
  }

  const selectedBalances = await getPeriodBalances(userStart, userEnd);
  const previousBalances = await getPeriodBalances(yearStart, prevEnd);

  const calculate = (acc, map) => {
    const bal = map[acc._id.toString()] || 0;
    return acc.balanceType === "credit" ? -bal : bal;
  };

  const cashReport = cashAccounts.map((acc) => ({
    _id: acc._id,
    name: acc.name,
    balance: calculate(acc, selectedBalances),
    previousBalance: calculate(acc, previousBalances),
  }));

  const operatingTypes = [
    "currentAsset",
    "currentLiabilities",
    "operatingExpenses",
    "nonOperatingExpenses",
  ];

  const operatingReport = {};

  operatingTypes.forEach((section) => {
    const accounts = operatingAccounts.filter((a) => a.accountType === section);
    const currentData = accounts.map((acc) => ({
      _id: acc._id,
      name: acc.name,
      balance: calculate(acc, selectedBalances),
      previousBalance: calculate(acc, previousBalances),
    }));
    const total = currentData.reduce((s, a) => s + a.balance, 0);
    const previousTotal = currentData.reduce(
      (s, a) => s + a.previousBalance,
      0,
    );
    operatingReport[section] = {
      total,
      previousTotal,
      accounts: currentData,
    };
  });

  const investingTypes = ["fixedAsset"];
  const investingReport = {};

  investingTypes.forEach((section) => {
    const accounts = investingAccounts.filter((a) => a.accountType === section);
    const currentData = accounts.map((acc) => ({
      _id: acc._id,
      name: acc.name,
      balance: calculate(acc, selectedBalances),
      previousBalance: calculate(acc, previousBalances),
    }));

    const total = currentData.reduce((s, a) => s + a.balance, 0);
    const previousTotal = currentData.reduce(
      (s, a) => s + a.previousBalance,
      0,
    );

    investingReport[section] = {
      total,
      previousTotal,
      accounts: currentData,
    };
  });

  const financingTypes = ["nonCurrentLiabilities", "equity", "currentAsset"];
  const financingReport = {};

  financingTypes.forEach((section) => {
    const accounts = financingAccounts.filter((a) => a.accountType === section);
    const currentData = accounts.map((acc) => ({
      _id: acc._id,
      name: acc.name,
      balance: calculate(acc, selectedBalances),
      previousBalance: calculate(acc, previousBalances),
    }));

    const total = currentData.reduce((s, a) => s + a.balance, 0);
    const previousTotal = currentData.reduce(
      (s, a) => s + a.previousBalance,
      0,
    );

    financingReport[section] = {
      total,
      previousTotal,
      accounts: currentData,
    };
  });

  res.status(200).json({
    selectedPeriod: {
      startDate,
      endDate,
    },
    previousPeriod: {
      startDate: yearStart,
      endDate: prevEnd,
    },
    cashReport,
    operatingReport,
    investingReport,
    financingReport,
  });
});
