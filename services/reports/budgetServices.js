const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const budgetModel = require("../../models/reports/budgetModel");
const accountingTreeModel = require("../../models/accountingTreeModel");
const journalEntryModel = require("../../models/journalEntryModel");

exports.createbudgetReport = asyncHandler(async (req, res) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  req.body.companyId = companyId;
  req.body.employee = req.user.name;

  const createbudget = await budgetModel.create(req.body);
  res.status(201).json({
    status: "success",
    message: "Report Created",
    data: createbudget,
  });
});

exports.getAccountForbudgetReport = asyncHandler(async (req, res, next) => {
  const { companyId, type } = req.query;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  // Determine final accounts based on type
  let finalAccounts = [];

  if (type === "pl") {
    finalAccounts = ["Profit and Loss Account", "Trading Account"];
  } else if (type === "bs") {
    finalAccounts = ["Balance Sheet"];
  } else {
    return res
      .status(400)
      .json({ message: "Invalid or missing type parameter" });
  }

  const accounts = await accountingTreeModel.find({
    companyId,
    finalAccount: { $in: finalAccounts },
  });

  res.status(200).json({
    status: "success",
    message: "Accounts fetched successfully",
    data: accounts,
  });
});

exports.getAllbudgetReport = asyncHandler(async (req, res, next) => {
  const { companyId, budgetCategory } = req.query;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  // Pagination
  const pageSize = parseInt(req.query.limit) || 10;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * pageSize;

  // Build filter object
  const filter = { companyId };

  if (budgetCategory) {
    filter.budgetCategory = budgetCategory; // profitLoss | balanceSheet
  }

  // Count first
  const totalItems = await budgetModel.countDocuments(filter);
  const totalPages = Math.ceil(totalItems / pageSize);

  // If no results
  if (totalItems === 0) {
    return res.status(200).json({
      status: "success",
      message: "No budget records found",
      totalPages: 0,
      results: 0,
      data: [],
    });
  }

  // Fetch items
  const budget = await budgetModel
    .find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(pageSize);

  res.status(200).json({
    status: "success",
    totalPages,
    results: totalItems,
    data: budget,
  });
});

exports.getOneBudgetReport = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const { id } = req.params;
  const budget = await budgetModel.findOne({
    _id: id,
    companyId,
  });
  res.status(201).json({
    status: "success",
    data: budget,
  });
});

exports.updateBudgetReport = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const { id } = req.params;

  // First find the budget
  const budget = await budgetModel.findOne({ _id: id, companyId });

  if (!budget) {
    return next(new ApiError(`No budget report found for id ${id}`, 404));
  }

  // Check status before update
  if (budget.status !== "draft") {
    return res.status(400).json({
      status: "fail",
      message: "This budget is approved and cannot be updated",
    });
  }

  // Now update since it's draft
  const updatedBudget = await budgetModel.findOneAndUpdate(
    { _id: id, companyId },
    req.body,
    { new: true },
  );

  res.status(200).json({
    status: "success",
    data: updatedBudget,
  });
});

exports.updateBudgetReportsStatus = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const { id } = req.params;

  const budget = await budgetModel.findOneAndUpdate(
    { _id: id, companyId },
    { status: req.body.status },
    { new: true },
  );

  if (!budget) {
    return next(new ApiError(`No budget report for this id ${id}`, 404));
  }
  res.status(201).json({ status: "success", data: budget });
});
function metaGet(meta, key) {
  return meta instanceof Map ? meta.get(key) : meta[key];
}

function metaSet(meta, key, value) {
  return meta instanceof Map ? meta.set(key, value) : (meta[key] = value);
}

exports.relocateBudget = asyncHandler(async (req, res) => {
  const { budgetId, accountId, type, from, to, employee, note } = req.body;

  const budget = await budgetModel.findById(budgetId);
  if (!budget) throw new Error("Budget not found");

  const acc = budget.account.find((a) => a.accountId.toString() === accountId);
  if (!acc) throw new Error("Account not found");

  let meta;

  if (type === "monthly") meta = acc.monthlyMeta;
  else if (type === "quarterly") meta = acc.quarterlyMeta;
  else meta = acc.yearlyMeta;

  // -------------------------------
  // ENSURE FROM EXISTS
  // -------------------------------
  let fromMeta = metaGet(meta, from.period);

  if (!fromMeta) {
    fromMeta = {
      relocatedFrom: false,
      relocatedTo: false,
      amountFrom: 0,
      amountTo: 0,
      netChange: 0,
    };
    metaSet(meta, from.period, fromMeta);
  }

  if (fromMeta.relocatedFrom)
    throw new Error("This period was already relocated from");

  // -------------------------------
  // VALIDATE AMOUNT
  // -------------------------------
  const totalTo = to.reduce((s, t) => s + t.amount, 0);
  if (totalTo !== from.amount)
    throw new Error("Distribution does not match FROM amount");

  // -------------------------------
  // UPDATE FROM PERIOD
  // -------------------------------
  fromMeta.relocatedFrom = true;
  fromMeta.amountFrom += from.amount;
  fromMeta.netChange = fromMeta.amountTo - fromMeta.amountFrom;

  metaSet(meta, from.period, fromMeta);

  // -------------------------------
  // UPDATE TO PERIODS
  // -------------------------------
  to.forEach((t) => {
    let toMeta = metaGet(meta, t.period);

    if (!toMeta) {
      toMeta = {
        relocatedFrom: false,
        relocatedTo: false,
        amountFrom: 0,
        amountTo: 0,
        netChange: 0,
      };
    }

    toMeta.relocatedTo = true;
    toMeta.amountTo += t.amount;
    toMeta.netChange = toMeta.amountTo - toMeta.amountFrom;

    metaSet(meta, t.period, toMeta);
  });

  // -------------------------------
  // LOG MOVEMENT
  // -------------------------------

  budget.movementLogs.push({
    accountId,
    fromPeriod: from.period,
    fromName: from.fromName,
    fromCode: from.fromCode,
    toPeriod: to.map((t) => ({
      period: t.period,
      amount: t.amount,
    })),
    amount: from.amount,
    employee,
    note,
    date: new Date(),
  });

  budget.markModified("account");
  await budget.save();

  res.json({
    success: true,
    message: "Budget relocated successfully",
  });
});

exports.getMonthJornal = asyncHandler(async (req, res) => {
  const { companyId, year } = req.query;
  const budgetId = req.params.id;

  if (!companyId || !year) {
    return res.status(400).json({ message: "companyId and year are required" });
  }

  const budgetAccount = await budgetModel.findOne({
    _id: budgetId,
    companyId,
  });

  if (!budgetAccount) {
    return res
      .status(404)
      .json({ message: "Budget not found Pls Chack Your ID" });
  }

  const journalEntries = await journalEntryModel.aggregate([
    {
      $addFields: {
        journalDateObj: { $toDate: "$journalDate" },
      },
    },

    {
      $match: {
        companyId,
        journalDateObj: {
          $gte: new Date(`${year}-01-01T00:00:00.000Z`),
          $lte: new Date(`${year}-12-31T23:59:59.999Z`),
        },
      },
    },
    { $unwind: "$journalAccounts" },

    {
      $addFields: {
        month: { $month: "$journalDateObj" },
      },
    },

    {
      $group: {
        _id: {
          accountId: "$journalAccounts.id",
          month: "$month",
        },
        totalDebit: { $sum: "$journalAccounts.MainDebit" },
        totalCredit: { $sum: "$journalAccounts.MainCredit" },
      },
    },
  ]);

  const formatted = {};

  journalEntries.forEach((entry) => {
    const { accountId, month } = entry._id;

    if (!formatted[accountId]) {
      formatted[accountId] = {
        jan: 0,
        feb: 0,
        mar: 0,
        apr: 0,
        may: 0,
        jun: 0,
        jul: 0,
        aug: 0,
        sep: 0,
        oct: 0,
        nov: 0,
        dec: 0,
      };
    }

    const monthNames = [
      "jan",
      "feb",
      "mar",
      "apr",
      "may",
      "jun",
      "jul",
      "aug",
      "sep",
      "oct",
      "nov",
      "dec",
    ];

    const mName = monthNames[month - 1];

    formatted[accountId][mName] += entry.totalDebit - entry.totalCredit;
  });

  const result = budgetAccount.account.map((acc) => {
    return {
      accountId: acc.accountId,
      name: acc.name,
      budgetMonthly: acc.monthly,
      actualMonthly: formatted[acc.accountId] || {
        jan: 0,
        feb: 0,
        mar: 0,
        apr: 0,
        may: 0,
        jun: 0,
        jul: 0,
        aug: 0,
        sep: 0,
        oct: 0,
        nov: 0,
        dec: 0,
      },
    };
  });

  return res.json({
    year,
    budgetId,
    data: result,
  });
});
