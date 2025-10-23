const accountingTreeModel = require("../../models/accountingTreeModel");
const journalEntryModel = require("../../models/journalEntryModel");
const asyncHandler = require("express-async-handler");

// exports.getClosingReports = asyncHandler(async (req, res) => {
//   const { companyId, startDate, endDate, finalAccount } = req.query;

//   if (!companyId || !startDate || !endDate) {
//     return res
//       .status(400)
//       .json({ message: "companyId, startDate, endDate are required" });
//   }

//   let totalDebit = 0,
//     totalCredit = 0;

//   const accounts = await accountingTreeModel.find({
//     companyId,
//     finalAccount,
//   });
//   console.log("accounts", accounts);
//   if (!accounts.length) {
//     return res
//       .status(404)
//       .json({ message: "No accounts found for this finalAccount" });
//   }

//   const accountIds = accounts.map((acc) => acc._id.toString());

//   const accountTotals = {};
//   const accountsMap = {};
//   accounts.forEach((acc) => {
//     accountsMap[acc._id.toString()] = acc;
//     accountTotals[acc._id.toString()] = {
//       id: acc._id.toString(),
//       name: acc.name,
//       code: acc.code,
//       accountType : code?.accountType,
//       parentId: acc.parentId || null,
//       parentCode: acc.parentCode || null,
//       debit: 0,
//       credit: 0,
//     };
//   });

//   const journals = await journalEntryModel
//     .find({
//       companyId,
//       journalDate: {
//         $gte: startDate + "T00:00:00.000Z",
//         $lte: endDate + "T23:59:59.999Z",
//       },
//       "journalAccounts.id": { $in: accountIds },
//     })
//     .lean();

//   const filteredJournals = journals.map((journal) => {
//     const journalAccountsFiltered = journal.journalAccounts.filter((ja) =>
//       accountIds.includes(ja.id)
//     );

//     journalAccountsFiltered.forEach((ja) => {
//       const accId = ja.id.toString();
//       if (accountTotals[accId]) {
//         accountTotals[accId].debit += ja.accountDebit || 0;
//         accountTotals[accId].credit += ja.accountCredit || 0;
//       }
//       totalDebit += ja.accountDebit || 0;
//       totalCredit += ja.accountCredit || 0;
//     });

//     return {
//       ...journal,
//       journalAccounts: journalAccountsFiltered,
//     };
//   });

//   return res.status(200).json({
//     status: "success",
//     totalCredit,
//     totalDebit,
//     accountTotals,
//   });
// });
exports.getClosingReports = asyncHandler(async (req, res) => {
  const { companyId, startDate, endDate, finalAccount } = req.query;

  if (!companyId || !startDate || !endDate) {
    return res
      .status(400)
      .json({ message: "companyId, startDate, endDate are required" });
  }

  let totalDebit = 0,
    totalCredit = 0;

  // 🧾 Fetch accounts with currency info
  const accounts = await accountingTreeModel.aggregate([
    {
      $match: {
        companyId,
        finalAccount,
      },
    },
    {
      $lookup: {
        from: "currencies",
        localField: "currency",
        foreignField: "_id",
        as: "currency",
      },
    },
    {
      $unwind: {
        path: "$currency",
        preserveNullAndEmptyArrays: true,
      },
    },
  ]);

  const accountTotals = {};
  const accountsMap = {};

  if (accounts.length) {
    const accountIds = accounts.map((acc) => acc._id.toString());

    accounts.forEach((acc) => {
      accountsMap[acc._id.toString()] = acc;
      accountTotals[acc._id.toString()] = {
        id: acc._id.toString(),
        name: acc.name,
        code: acc.code,
        accountType: acc.accountType,
        balanceType: acc.balanceType,
        parentId: acc.parentId || null,
        parentCode: acc.parentCode || null,
        debit: 0,
        credit: 0,
        currency: acc.currency || null,
      };
    });

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

    journals.forEach((journal) => {
      const journalAccountsFiltered = journal.journalAccounts.filter((ja) =>
        accountIds.includes(ja.id)
      );

      journalAccountsFiltered.forEach((ja) => {
        const accId = ja.id.toString();
        if (accountTotals[accId]) {
          accountTotals[accId].debit += ja.accountDebit || 0;
          accountTotals[accId].credit += ja.accountCredit || 0;
        }
        totalDebit += ja.accountDebit || 0;
        totalCredit += ja.accountCredit || 0;
      });
    });
  }

  // 🧮 Convert totals into array for frontend
  const accountTotalsArray = Object.values(accountTotals);

  return res.status(200).json({
    status: "success",
    totalCredit,
    totalDebit,
    accountTotals: accountTotalsArray, // empty if no accounts
  });
});
exports.createClosingReports = asyncHandler(async (req, res) => {
  const { companyId, startDate, endDate, finalAccount } = req.query;

  if (!companyId || !startDate || !endDate) {
    return res
      .status(400)
      .json({ message: "companyId, startDate, endDate are required" });
  }
});
