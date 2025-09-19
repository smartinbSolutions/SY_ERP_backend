const accountingTreeModel = require("../../models/accountingTreeModel");
const journalEntryModel = require("../../models/journalEntryModel");
const asyncHandler = require("express-async-handler");

exports.getClosingReports = asyncHandler(async (req, res) => {
  const { companyId, startDate, endDate, finalAccount } = req.query;

  if (!companyId || !startDate || !endDate) {
    return res
      .status(400)
      .json({ message: "companyId, startDate, endDate are required" });
  }
  let totalDebit = 0,
    totalCredit = 0;
  const accounts = await accountingTreeModel.find({
    companyId,
    finalAccount,
  });

  if (!accounts.length) {
    return res
      .status(404)
      .json({ message: "No accounts found for this finalAccount" });
  }

  const accountIds = accounts.map((acc) => acc._id.toString());

  const journals = await journalEntryModel
    .find({
      companyId,
      journalDate: {
        $gte: startDate + "T00:00:00.000Z",
        $lte: endDate + "T23:59:59.999Z",
      },
      "journalAccounts.id": { $in: accountIds },
    })
    .lean();

  const accountTotals = {};
  const accountsMap = {};
  accounts.forEach((acc) => {
    accountsMap[acc._id.toString()] = acc;
  });
  const filteredJournals = journals.map((journal) => {
    const journalAccountsFiltered = journal.journalAccounts.filter((ja) =>
      accountIds.includes(ja.id)
    );
    journalAccountsFiltered.forEach((ja) => {
      const accountInfo = accountsMap[ja.id];
      console.log(accountInfo);

      if (!accountTotals[ja.id]) {
        accountTotals[ja.id] = {
          id: ja.id,
          name: ja.name,
          parent: accountInfo?.parentId || null,
          debit: 0,
          credit: 0,
        };
      }
      accountTotals[ja.id].debit += ja.accountDebit || 0;
      accountTotals[ja.id].credit += ja.accountCredit || 0;
      totalDebit += ja.accountDebit;
      totalCredit += ja.accountCredit;
    });

    return {
      ...journal,
      journalAccounts: journalAccountsFiltered,
    };
  });

  return res.status(200).json({
    status: "success",
    totalCredit,
    totalDebit,
    accountTotals,
  });
});
