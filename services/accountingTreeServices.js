const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const AccountingTree = require("../models/accountingTreeModel");
const ApiError = require("../utils/apiError");
const xlsx = require("xlsx");
const currencySchema = require("../models/currencyModel");
const journalEntryModel = require("../models/journalEntryModel");

exports.getAccountingTree = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const posted = req.query.posted || false;
  try {
    const type = req.params.id;
    const filter = type
      ? { companyId, $or: [{ code: type }, { accountType: type }] }
      : { companyId };

    // Use aggregation pipeline to sort by numeric code safely
    const accounts = await AccountingTree.aggregate([
      { $match: filter },
      {
        $addFields: {
          numericCode: {
            $convert: {
              input: "$code",
              to: "double",
              onError: null,
              onNull: null,
            },
          },
        },
      },
      { $sort: { numericCode: 1 } },
      {
        $lookup: {
          from: "currencies",
          localField: "currency",
          foreignField: "_id",
          as: "currency",
        },
      },
      { $unwind: { path: "$currency", preserveNullAndEmptyArrays: true } },
    ]);

    const buildTree = (data, parentCode = null) => {
      return data
        .filter((item) => item.parentCode === parentCode)
        .map((item) => {
          const children = buildTree(data, item.code);

          return {
            ...item,
            children: children.length > 0 ? children : [],
          };
        });
    };

    const treeData = buildTree(accounts);
    res.status(200).json({ status: "success", data: treeData });
  } catch (error) {
    next(error);
  }
});

// exports.getAccountingTreeFromJournals = asyncHandler(async (req, res, next) => {
//   const { companyId, startDate, endDate } = req.query;

//   if (!companyId) {
//     return res.status(400).json({ message: "companyId is required" });
//   }
//   let startDates;
//   let endDates;
//   try {
//     // 1️⃣ Fetch chart of accounts
//     const accounts = await AccountingTree.aggregate([
//       { $match: { companyId } },
//       {
//         $addFields: {
//           numericCode: {
//             $convert: {
//               input: "$code",
//               to: "double",
//               onError: null,
//               onNull: null,
//             },
//           },
//         },
//       },
//       { $sort: { numericCode: 1 } },
//       {
//         $lookup: {
//           from: "currencies",
//           localField: "currency",
//           foreignField: "_id",
//           as: "currency",
//         },
//       },
//       { $unwind: { path: "$currency", preserveNullAndEmptyArrays: true } },
//     ]);

//     // 2️⃣ Remove all filters — fetch ALL journals for this company

//     if (startDate && endDate) {
//       startDates = `${startDate}T00:00:00.000Z`;
//       endDates = `${endDate}T23:59:59.999Z`;
//     }
//     const match = {
//       companyId,
//       ...(startDates && endDates
//         ? { journalDate: { $gte: startDates, $lte: endDates } }
//         : {}),
//     };
//     // 3️⃣ Aggregate journal totals grouped by account ID (as string)
//     const journalSums = await journalEntryModel.aggregate([
//       { $match: match },
//       { $unwind: "$journalAccounts" },
//       {
//         $group: {
//           _id: { $toString: "$journalAccounts.id" }, // normalize IDs
//           totalDebit: { $sum: "$journalAccounts.MainDebit" },
//           totalCredit: { $sum: "$journalAccounts.MainCredit" },
//         },
//       },
//     ]);

//     // 4️⃣ Create balance map
//     const balanceMap = {};
//     for (const j of journalSums) {
//       balanceMap[j._id] = {
//         totalDebit: j.totalDebit || 0,
//         totalCredit: j.totalCredit || 0,
//         balance: (j.totalDebit || 0) - (j.totalCredit || 0),
//       };
//     }

//     // 5️⃣ Build the tree and attach balances
//     const buildTree = (data, parentCode = null) =>
//       data
//         .filter((acc) => acc.parentCode === parentCode)
//         .map((acc) => {
//           const children = buildTree(data, acc.code);
//           const bal = balanceMap[acc._id.toString()] || {
//             totalDebit: 0,
//             totalCredit: 0,
//             balance: 0,
//           };

//           const normalizedBalance =
//             acc.balanceType === "credit" ? -bal.balance : bal.balance;

//           return {
//             ...acc,
//             totalDebit: bal.totalDebit,
//             totalCredit: bal.totalCredit,
//             balance: normalizedBalance,
//             children: children.length > 0 ? children : [],
//           };
//         });

//     const treeData = buildTree(accounts);

//     // 6️⃣ Global totals
//     const totalDebit = Object.values(balanceMap).reduce(
//       (sum, v) => sum + v.totalDebit,
//       0,
//     );
//     const totalCredit = Object.values(balanceMap).reduce(
//       (sum, v) => sum + v.totalCredit,
//       0,
//     );

//     res.status(200).json({
//       status: "success",
//       companyId,
//       totals: {
//         totalDebit,
//         totalCredit,
//         totalBalance: totalDebit - totalCredit,
//       },
//       data: treeData,
//     });
//   } catch (error) {
//     next(error);
//   }
// });
exports.getAccountingTreeFromJournals = asyncHandler(async (req, res, next) => {
  const { companyId, startDate, endDate } = req.query;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  try {
    /* ============================================
       1) GET ACCOUNTS (lean + populate)
    ============================================ */
    const accounts = await AccountingTree.find({ companyId })
      .populate("currency")
      .lean();

    /* ============================================
       2) JOURNAL AGGREGATION (server-side)
       NOTE: journalDate is String in your schema, so we must parse it.
       Long-term: store journalDate as Date for index usage.
    ============================================ */
    const pipeline = [
      { $match: { companyId } },
      {
        $addFields: {
          journalDateObj: {
            $dateFromString: {
              dateString: "$journalDate",
              onError: null,
              onNull: null,
            },
          },
        },
      },
    ];

    if (startDate && endDate) {
      pipeline.push({
        $match: {
          journalDateObj: {
            $gte: new Date(`${startDate}T00:00:00.000Z`),
            $lte: new Date(`${endDate}T23:59:59.999Z`),
          },
        },
      });
    }

    pipeline.push(
      { $unwind: "$journalAccounts" },
      {
        $group: {
          _id: { $toString: "$journalAccounts.id" }, // normalize
          totalDebit: { $sum: "$journalAccounts.MainDebit" },
          totalCredit: { $sum: "$journalAccounts.MainCredit" },
        },
      }
    );

    const journalSums = await journalEntryModel.aggregate(pipeline);

    /* ============================================
       3) BALANCE MAP (accountId -> totals)
    ============================================ */
    const balanceMap = Object.create(null);
    for (const j of journalSums) {
      balanceMap[String(j._id)] = {
        totalDebit: Number(j.totalDebit || 0),
        totalCredit: Number(j.totalCredit || 0),
      };
    }

    /* ============================================
       4) BUILD ACCOUNT MAP (code -> node)
       ✅ Project only needed fields (lighter payload)
       ✅ Normalize initial balance using balanceType
    ============================================ */
    const accountMap = Object.create(null);

    for (const acc of accounts) {
      const idStr = String(acc._id);
      const bal = balanceMap[idStr] || { totalDebit: 0, totalCredit: 0 };

      const totalDebit = bal.totalDebit;
      const totalCredit = bal.totalCredit;
      const balance = calcBalanceByType(acc, totalDebit, totalCredit);

      accountMap[String(acc.code)] = {
        _id: acc._id,
        name: acc.name,
        nameAr: acc.nameAr,
        nameTr: acc.nameTr,
        code: acc.code,
        accountType: acc.accountType,
        balanceType: acc.balanceType,
        parentId: acc.parentId,
        parentCode: acc.parentCode,
        currency: acc.currency || null,

        // ✅ calculated fields (leaf base totals)
        totalDebit,
        totalCredit,
        balance,

        children: [],
      };
    }

    /* ============================================
       5) BUILD TREE STRUCTURE
    ============================================ */
    const tree = [];
    for (const acc of accounts) {
      const node = accountMap[String(acc.code)];
      if (!node) continue;

      if (acc.parentCode && accountMap[String(acc.parentCode)]) {
        accountMap[String(acc.parentCode)].children.push(node);
      } else {
        tree.push(node);
      }
    }

    /* ============================================
       6) RECURSIVE ROLLUP (parent totals)
       ✅ parent totals include children totals
       ✅ balanceType normalization for every node
    ============================================ */
    const rollup = (node) => {
      let debitSum = Number(node.totalDebit || 0);
      let creditSum = Number(node.totalCredit || 0);

      const kids = node.children || [];
      for (const child of kids) {
        const childTotals = rollup(child);
        debitSum += childTotals.totalDebit;
        creditSum += childTotals.totalCredit;
      }

      node.totalDebit = debitSum;
      node.totalCredit = creditSum;
      node.balance = calcBalanceByType(node, debitSum, creditSum);

      return { totalDebit: debitSum, totalCredit: creditSum };
    };

    for (const node of tree) rollup(node);

    /* ============================================
       7) SORT TREE (server-side)
    ============================================ */
    const sortedTree = sortNodesByCode(tree);

    /* ============================================
       8) GLOBAL TOTALS
       ✅ IMPORTANT: totals should be summed as raw debit/credit
       ✅ totalBalance here is "debit - credit" in main currency sense.
       If you want a different convention, adjust here.
    ============================================ */
    let totalDebit = 0;
    let totalCredit = 0;

    for (const n of sortedTree) {
      totalDebit += Number(n.totalDebit || 0);
      totalCredit += Number(n.totalCredit || 0);
    }

    /* ============================================
       9) RESPONSE
    ============================================ */
    return res.status(200).json({
      status: "success",
      companyId,
      filter: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
      totals: {
        totalDebit,
        totalCredit,
        totalBalance: totalDebit - totalCredit,
      },
      data: sortedTree,
    });
  } catch (error) {
    next(error);
  }
});
exports.getChartOfAccounts = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const accounts = await AccountingTree.find({ companyId })
    .select("code name nameAr nameTr parent balanceType accountType currency")
    .lean();

  // 🔹 Build map
  const accountMap = {};
  const rootAccounts = [];

  accounts.forEach((account) => {
    account.children = [];
    accountMap[account._id] = account;
  });

  accounts.forEach((account) => {
    if (account.parent) {
      if (accountMap[account.parent]) {
        accountMap[account.parent].children.push(account);
      }
    } else {
      rootAccounts.push(account);
    }
  });

  // 🔹 Optional: sort by code
  const sortByCode = (nodes) => {
    nodes.sort((a, b) => {
      const aParts = a.code.split(".").map(Number);
      const bParts = b.code.split(".").map(Number);
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aVal = aParts[i] ?? 0;
        const bVal = bParts[i] ?? 0;
        if (aVal !== bVal) return aVal - bVal;
      }
      return 0;
    });

    nodes.forEach((node) => {
      if (node.children.length > 0) {
        sortByCode(node.children);
      }
    });
  };

  sortByCode(rootAccounts);

  res.status(200).json({
    results: rootAccounts.length,
    data: rootAccounts,
  });
});

exports.getAccountingTreeNoBalance = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const account = await AccountingTree.find({ companyId }).sort({ code: -1 });

  res.status(200).json({ results: account.length, data: account });
});

exports.getAccountingTreeForExport = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const account = await AccountingTree.find({ companyId })
    .populate("currency")
    .sort({ code: 1 });

  res.status(200).json({ results: account.length, data: account });
});

exports.createAccountingTree = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  req.body.companyId = companyId;
  const createAccount = await AccountingTree.create(req.body);

  res.status(200).json({ status: "success", data: createAccount });
});

exports.updateAccountingTree = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  req.body.companyId = companyId;
  const { id } = req.params;
  const updateTree = await AccountingTree.findOneAndUpdate(
    { _id: id, companyId },
    req.body,
    {
      new: true,
    }
  );

  res.status(200).json({ status: "success", data: updateTree });
});

exports.getAccountingTreeByCode = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const type = req.params.id;
  const getAllAccount = await AccountingTree.find({
    companyId,
    $or: [{ code: type }, { accountType: type }],
  });
  res.status(200).json({ status: "success", data: getAllAccount });
});

exports.deleteAccountingTree = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  req.body.companyId = companyId;

  const { id } = req.params;

  const accountingTree = await AccountingTree.find({
    companyId,
    $or: [{ code: id }, { parentCode: id }],
  });

  if (!accountingTree) {
    return next(new ApiError(`not fund the account Tree for this code ${id}`));
  }

  if (
    accountingTree.length === 1 &&
    accountingTree[0].debtor === 0 &&
    accountingTree[0].creditor === 0
  ) {
    const deleteAccountTree = await AccountingTree.deleteOne({ code: id });
  } else if (accountingTree.length > 1) {
    return next(new ApiError(`this Account ${id} have Children`));
  } else if (accountingTree.debtor !== 0 || accountingTree.creditor !== 0) {
    return next(new ApiError(`this Account ${id} have Finincial operations`));
  } else {
    return next(new ApiError(`this Account ${id} have not been found`));
  }
  res.status(200).json({
    status: "true",
    meesage: "deleted",
  });
});

exports.importAccountingTree = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  // Check if file is provided
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  const { buffer } = req.file;
  let csvData;

  if (
    req.file.originalname.endsWith(".csv") ||
    req.file.mimetype === "text/csv"
  ) {
    csvData = await csvtojson().fromString(buffer.toString());
  } else if (
    req.file.originalname.endsWith(".xlsx") ||
    req.file.mimetype ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    const workbook = xlsx.read(buffer, { type: "buffer" });
    const sheet_name_list = workbook.SheetNames;
    csvData = xlsx.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);
  } else {
    return res.status(400).json({ error: "Unsupported file type" });
  }
  for (const item of csvData) {
    // Find IDs for currency, category, unit, and brand
    const currency = await currencySchema.findOne({
      companyId,
      currencyName: item.currency,
    });
    item.currency = currency?._id;
    item.companyId = companyId;
  }
  try {
    // Insert Tree into the database
    const insertedTree = await AccountingTree.insertMany(csvData, {
      ordered: false,
    });

    res.status(200).json({
      status: "success",
      message: "Tree imported successfully",
      data: insertedTree,
    });
  } catch (error) {
    res.status(500).json({
      status: "faild",
      error: error.message,
    });
  }
});

exports.changeBalance = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const { id } = req.params;

  const account = await AccountingTree.findOneAndUpdate(
    { _id: id, companyId: companyId },
    {
      $inc: { debtor: req.body.debtor || 0, creditor: req.body.creditor || 0 },
    },
    { new: true }
  );

  res
    .status(200)
    .json({ status: "success", message: "balance Updated", data: account });
});

exports.getOneAccountingTree = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const { id } = req.params;

  const findOneAccount = await AccountingTree.findOne({
    _id: id,
    companyId,
  });

  res.status(200).json({ status: "success", data: findOneAccount });
});
exports.calculateBalance = asyncHandler(async (req, res) => {
  const companyId = req.query.companyId;
  if (!companyId)
    return res.status(400).json({ message: "companyId is required" });

  const { startDate, endDate } = req.query;

  const startDates = `${startDate}T00:00:00.000Z`;
  const endDates = `${endDate}T23:59:59.999Z`;
  const match = {
    companyId,
    journalDate: { $gte: startDates, $lte: endDates },
  };

  const journalSums = await journalEntryModel.aggregate([
    { $match: match },
    { $unwind: "$journalAccounts" },

    { $match: { "journalAccounts.id": { $exists: true, $ne: null, $ne: "" } } },

    {
      $lookup: {
        from: "accountingtrees",
        let: {
          accId: {
            $convert: {
              input: "$journalAccounts.id",
              to: "objectId",
              onError: null,
              onNull: null,
            },
          },
        },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$accId"] } } },
          { $project: { finalAccount: 1, balanceType: 1 } },
        ],
        as: "acc",
      },
    },

    { $unwind: "$acc" },

    { $match: { "acc.finalAccount": "Balance Sheet" } },

    {
      $group: {
        _id: { $toString: "$journalAccounts.id" },
        totalDebit: { $sum: { $ifNull: ["$journalAccounts.MainDebit", 0] } },
        totalCredit: { $sum: { $ifNull: ["$journalAccounts.MainCredit", 0] } },
        balance: {
          $sum: {
            $subtract: [
              { $ifNull: ["$journalAccounts.MainDebit", 0] },
              { $ifNull: ["$journalAccounts.MainCredit", 0] },
            ],
          },
        },
        balanceType: { $first: "$acc.balanceType" },
      },
    },
  ]);

  const round4 = (n) => Math.round((Number(n) || 0) * 10000) / 10000;

  const totalDebit = round4(
    journalSums.reduce((sum, v) => sum + (Number(v.totalDebit) || 0), 0)
  );

  const totalCredit = round4(
    journalSums.reduce((sum, v) => sum + (Number(v.totalCredit) || 0), 0)
  );
  const totalBalance = round4(
    journalSums.reduce((sum, v) => sum + (Number(v.balance) || 0), 0)
  );
  const diff = round4(totalDebit - totalCredit);

  return res.json({
    totalDebit,
    totalCredit,
    totalBalance,
    diff,
    isBalanced: diff === 0,
    byAccount: journalSums,
  });
});

// ---- helpers ----
const sortNodesByCode = (nodes = []) => {
  const sorted = [...nodes].sort((a, b) => {
    const aParts = String(a.code || "")
      .split(".")
      .map((x) => Number(x) || 0);
    const bParts = String(b.code || "")
      .split(".")
      .map((x) => Number(x) || 0);

    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const av = aParts[i] ?? 0;
      const bv = bParts[i] ?? 0;
      if (av !== bv) return av - bv;
    }
    return 0;
  });

  return sorted.map((n) => ({
    ...n,
    children: sortNodesByCode(n.children || []),
  }));
};

const calcBalanceByType = (node, debit, credit) => {
  const bt = String(node.balanceType || "").toLowerCase();
  // debit accounts: Dr - Cr
  // credit accounts: Cr - Dr
  return bt === "credit" ? credit - debit : debit - credit;
};
