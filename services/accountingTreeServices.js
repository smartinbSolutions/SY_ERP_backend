const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const AccountingTree = require("../models/accountingTreeModel");
const ApiError = require("../utils/apiError");
const xlsx = require("xlsx");
const currencySchema = require("../models/Settings/currency.model");
const journalEntryModel = require("../models/journalEntryModel");

exports.getAccountingTree = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({
      message: "companyId is required",
    });
  }

  try {
    const type = req.params.id;

    const filter = type
      ? {
          companyId,
          $or: [{ code: type }, { accountType: type }],
        }
      : { companyId };

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
      {
        $unwind: {
          path: "$currency",
          preserveNullAndEmptyArrays: true,
        },
      },
    ]);

    const journalSums = await journalEntryModel.aggregate([
      {
        $match: {
          companyId,
        },
      },
      { $unwind: "$journalAccounts" },
      {
        $group: {
          _id: {
            $toString: "$journalAccounts.id",
          },
          totalDebit: {
            $sum: {
              $ifNull: ["$journalAccounts.MainDebit", 0],
            },
          },
          totalCredit: {
            $sum: {
              $ifNull: ["$journalAccounts.MainCredit", 0],
            },
          },
        },
      },
    ]);

    const journalMap = new Map(
      journalSums.map((item) => [
        item._id,
        {
          totalDebit: item.totalDebit,
          totalCredit: item.totalCredit,
        },
      ]),
    );

    const accountsWithBalance = accounts.map((account) => {
      const journal = journalMap.get(account._id.toString());

      return {
        ...account,
        totalDebit: journal?.totalDebit || 0,
        totalCredit: journal?.totalCredit || 0,
      };
    });

    const buildTree = (data, parentCode = null) => {
      return data
        .filter((item) => item.parentCode === parentCode)
        .map((item) => ({
          ...item,
          children: buildTree(data, item.code),
        }));
    };

    const treeData = buildTree(accountsWithBalance);

    res.status(200).json({
      status: "success",
      data: treeData,
    });
  } catch (error) {
    next(error);
  }
});

exports.getAccountingTreeFromJournals = asyncHandler(async (req, res, next) => {
  const { startDate, endDate } = req.query;
  const companyId = req.companyId;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  try {
    /* ============================================
       1) GET ACCOUNTS
    ============================================ */
    const accounts = await AccountingTree.find({ companyId })
      .populate("currency")
      .lean();

    /* ============================================
       2) OPTIONAL DATA HEALTH CHECK
       - detect duplicate codes inside same company
       - should not break request, but log loudly
    ============================================ */
    const codeCounts = Object.create(null);

    for (const acc of accounts) {
      const code = String(acc.code || "").trim();
      if (!code) continue;
      codeCounts[code] = (codeCounts[code] || 0) + 1;
    }

    const duplicateCodes = Object.entries(codeCounts)
      .filter(([, count]) => count > 1)
      .map(([code, count]) => ({ code, count }));

    if (duplicateCodes.length) {
      console.error(
        "Duplicate account codes found in AccountingTree:",
        duplicateCodes,
      );
    }

    /* ============================================
       3) JOURNAL AGGREGATION
       NOTE: journalDate is String in schema
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
          _id: { $toString: "$journalAccounts.id" },
          totalDebit: { $sum: { $ifNull: ["$journalAccounts.MainDebit", 0] } },
          totalCredit: {
            $sum: { $ifNull: ["$journalAccounts.MainCredit", 0] },
          },
        },
      },
    );

    const journalSums = await journalEntryModel.aggregate(pipeline);

    /* ============================================
       4) BALANCE MAP (accountId -> totals)
    ============================================ */
    const balanceMap = Object.create(null);

    for (const j of journalSums) {
      balanceMap[String(j._id)] = {
        totalDebit: Number(j.totalDebit || 0),
        totalCredit: Number(j.totalCredit || 0),
      };
    }

    /* ============================================
       5) BUILD NODE MAPS
       - nodeById: true node identity
       - idByCode: fallback lookup only
    ============================================ */
    const nodeById = Object.create(null);
    const idByCode = Object.create(null);

    for (const acc of accounts) {
      const idStr = String(acc._id);
      const codeStr = String(acc.code || "").trim();
      const parentCodeStr = acc.parentCode
        ? String(acc.parentCode).trim()
        : null;
      const parentIdStr = acc.parentId ? String(acc.parentId).trim() : null;

      const bal = balanceMap[idStr] || { totalDebit: 0, totalCredit: 0 };
      const totalDebit = Number(bal.totalDebit || 0);
      const totalCredit = Number(bal.totalCredit || 0);

      nodeById[idStr] = {
        _id: acc._id,
        name: acc.name,
        nameAr: acc.nameAr,
        nameTr: acc.nameTr,
        code: codeStr,
        accountType: acc.accountType,
        balanceType: acc.balanceType,
        parentId: parentIdStr,
        parentCode: parentCodeStr,
        currency: acc.currency || null,
        totalDebit,
        totalCredit,
        balance: calcBalanceByType(acc, totalDebit, totalCredit),
        children: [],
      };

      // keep first seen code as fallback reference
      if (codeStr && !idByCode[codeStr]) {
        idByCode[codeStr] = idStr;
      }
    }

    /* ============================================
       6) BUILD TREE STRUCTURE
       - prefer parentId
       - fallback to parentCode
       - prevent duplicate attachment
    ============================================ */
    const tree = [];
    const attachedNodeIds = new Set();

    for (const acc of accounts) {
      const idStr = String(acc._id);
      const node = nodeById[idStr];
      if (!node) continue;

      const rawParentId = acc.parentId ? String(acc.parentId).trim() : null;
      const rawParentCode = acc.parentCode
        ? String(acc.parentCode).trim()
        : null;

      let parentNode = null;

      if (rawParentId && nodeById[rawParentId]) {
        parentNode = nodeById[rawParentId];
      } else if (rawParentCode && idByCode[rawParentCode]) {
        parentNode = nodeById[idByCode[rawParentCode]];
      }

      if (parentNode) {
        const alreadyInParent = parentNode.children.some(
          (child) => String(child._id) === idStr,
        );

        if (!alreadyInParent) {
          parentNode.children.push(node);
        }

        attachedNodeIds.add(idStr);
      } else {
        if (!attachedNodeIds.has(idStr)) {
          const alreadyInTree = tree.some((root) => String(root._id) === idStr);
          if (!alreadyInTree) {
            tree.push(node);
          }
          attachedNodeIds.add(idStr);
        }
      }
    }

    /* ============================================
       7) ROLLUP
       - protect against accidental cycles
    ============================================ */
    const rollup = (node, visited = new Set()) => {
      const nodeId = String(node._id);

      if (visited.has(nodeId)) {
        console.error("Cycle detected in accounting tree at node:", {
          _id: nodeId,
          code: node.code,
          name: node.name,
        });

        return {
          totalDebit: Number(node.totalDebit || 0),
          totalCredit: Number(node.totalCredit || 0),
        };
      }

      visited.add(nodeId);

      let debitSum = Number(node.totalDebit || 0);
      let creditSum = Number(node.totalCredit || 0);

      const kids = Array.isArray(node.children) ? node.children : [];

      for (const child of kids) {
        const childTotals = rollup(child, new Set(visited));
        debitSum += Number(childTotals.totalDebit || 0);
        creditSum += Number(childTotals.totalCredit || 0);
      }

      node.totalDebit = debitSum;
      node.totalCredit = creditSum;
      node.balance = calcBalanceByType(node, debitSum, creditSum);

      return { totalDebit: debitSum, totalCredit: creditSum };
    };

    for (const node of tree) {
      rollup(node);
    }

    /* ============================================
       8) SORT TREE
    ============================================ */
    const sortedTree = sortNodesByCode(tree);

    /* ============================================
       9) GLOBAL TOTALS
    ============================================ */
    let totalDebit = 0;
    let totalCredit = 0;

    for (const n of sortedTree) {
      totalDebit += Number(n.totalDebit || 0);
      totalCredit += Number(n.totalCredit || 0);
    }

    /* ============================================
       10) RESPONSE
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
      duplicateCodes, // optional, remove in production if you do not want to expose it
      data: sortedTree,
    });
  } catch (error) {
    next(error);
  }
});
exports.getChartOfAccounts = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

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
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const account = await AccountingTree.find({ companyId }).sort({ code: -1 });

  res.status(200).json({ results: account.length, data: account });
});

exports.getAccountingTreeForExport = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const account = await AccountingTree.find({ companyId })
    .populate("currency")
    .sort({ code: 1 });

  res.status(200).json({ results: account.length, data: account });
});

exports.createAccountingTree = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  req.body.companyId = companyId;
  const createAccount = await AccountingTree.create(req.body);

  res.status(200).json({ status: "success", data: createAccount });
});

exports.updateAccountingTree = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

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
    },
  );

  res.status(200).json({ status: "success", data: updateTree });
});

exports.getAccountingTreeByCode = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

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
  const companyId = req.companyId;

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
  const companyId = req.companyId;

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
  const currencyNames = [
    ...new Set(
      csvData
        .map((item) => item.currency)
        .filter(Boolean)
        .map((currencyName) => String(currencyName).trim()),
    ),
  ];

  const currencies = currencyNames.length
    ? await currencySchema
        .find({
          companyId,
          $or: [
            { currencyName: { $in: currencyNames } },
            { currencyCode: { $in: currencyNames } },
          ],
        })
        .select("_id currencyName currencyCode")
        .lean()
    : [];

  const currencyMap = new Map();
  currencies.forEach((currency) => {
    currencyMap.set(currency.currencyName, currency._id);
    currencyMap.set(currency.currencyCode, currency._id);
  });

  const treeRows = csvData.map((item) => {
    const currencyName = item.currency ? String(item.currency).trim() : "";

    return {
      ...item,
      currency: currencyMap.get(currencyName),
      companyId,
    };
  });

  try {
    // Insert Tree into the database
    const insertedTree = await AccountingTree.insertMany(treeRows, {
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
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const { id } = req.params;

  const account = await AccountingTree.findOneAndUpdate(
    { _id: id, companyId: companyId },
    {
      $inc: { debtor: req.body.debtor || 0, creditor: req.body.creditor || 0 },
    },
    { new: true },
  );

  res
    .status(200)
    .json({ status: "success", message: "balance Updated", data: account });
});

exports.getOneAccountingTree = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

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
  const companyId = req.companyId;
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
    journalSums.reduce((sum, v) => sum + (Number(v.totalDebit) || 0), 0),
  );

  const totalCredit = round4(
    journalSums.reduce((sum, v) => sum + (Number(v.totalCredit) || 0), 0),
  );
  const totalBalance = round4(
    journalSums.reduce((sum, v) => sum + (Number(v.balance) || 0), 0),
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
