const financialFundsModel = require("../../../../models/Accounting/CurrentAssets/financialFundsModel");
const reportsFinancialFunds = require("../../../../models/Accounting/CurrentAssets/reportsFinancialFunds");
const salesPointModel = require("../../../../models/salesPointModel");
const counterModel = require("../../../../models/Settings/counterModel");
const ApiError = require("../../../../utils/apiError");
const {
  createJournalEntryService,
} = require("../../JournalEntries/journalEntries.Service");

exports.findAllFundAndBankService = async ({ req, companyId }) => {
  let query = { archives: { $ne: false }, companyId };

  const fundAndBanks = await financialFundsModel
    .find(query)
    .populate({
      path: "fundCurrency",
      select: "_id currencyCode currencyName exchangeRate",
    })
    .populate({
      path: "linkAccount",
      populate: { path: "currency" },
    });

  return { fundAndBanks, totalItems: fundAndBanks.length };
};

exports.createFundAndBankService = async ({ req, companyId, session }) => {
  const {
    fundName,
    type,
    fundCurrency,
    linkAccount,
    fundBalance = 0,
    balanceDirection = "DEBIT",
    tags = [],
    date,
    description = "",
    openingBalanceJournal,
    journalCounter,
  } = req.body;

  // ── 1. Create the fund ───────────────────────────────────────────
  // fundBalance is stored as a signed number:
  //   DEBIT  → positive (asset increases)
  //   CREDIT → negative (overdraft / liability position)
  const signedBalance =
    balanceDirection === "CREDIT"
      ? -Math.abs(Number(fundBalance))
      : Math.abs(Number(fundBalance));

  const fundDocs = await financialFundsModel.create(
    [
      {
        fundName,
        type,
        fundCurrency,
        linkAccount,
        fundBalance: signedBalance,
        tags,
        date: date || new Date(),
        description,
        companyId,
      },
    ],
    { session }
  );

  const fundAndBank = fundDocs[0];

  // ── 2. Opening balance — skip when zero ──────────────────────────
  // No row, no journal when there's no opening movement.
  const hasOpeningBalance = Number(fundBalance) !== 0;

  if (hasOpeningBalance) {
    // ── 2a. Report row ─────────────────────────────────────────────
    // direction "in"  = balance debit (money present in the fund)
    // direction "out" = balance credit (overdraft / negative position)
    await reportsFinancialFunds.create(
      [
        {
          date: date || new Date(),
          amount: Math.abs(Number(fundBalance)),
          direction: balanceDirection === "DEBIT" ? "in" : "out",
          source: "opening_balance",
          refType: "manual",
          refId: fundAndBank._id,
          payment: null,
          financialFundId: fundAndBank._id,
          financialFundRest: signedBalance,
          description: description || `Opening balance for ${fundName}`,
          createdBy: req.user?._id || null,
          companyId,
        },
      ],
      { session }
    );

    // ── 2b. Journal entry ──────────────────────────────────────────
    // Only when frontend sent a non-skip journal preview.
    if (openingBalanceJournal && !openingBalanceJournal.skip) {
      const nextCounterJournal = await counterModel.findOneAndUpdate(
        { companyId, name: "Journal" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, session }
      );

      await createJournalEntryService({
        data: {
          ...openingBalanceJournal.journalMeta,
          journalAccounts: openingBalanceJournal.journalAccounts,
          counter: journalCounter || 0,
          refId: fundAndBank._id,
          refCounter: fundAndBank.counter || "",
        },
        companyId,
        nextCounterJournal,
        session,
      });
    }
  }

  return { fundAndBank };
};

exports.createFundAdjustmentService = async ({ req, companyId, session }) => {
  const {
    fundId,
    amount,
    direction,
    date,
    description = "",
    adjustmentJournal,
    journalCounter,
  } = req.body;

  // ── Validate ────────────────────────────────────────────────────
  if (!fundId) throw new Error("fundId is required");

  if (!["in", "out"].includes(direction)) {
    throw new Error("direction must be 'in' or 'out'");
  }

  const numericAmount = Number(amount);
  if (!numericAmount || numericAmount <= 0) {
    throw new Error("amount must be a positive number");
  }

  if (!description?.trim()) {
    throw new Error("description (reason) is required for manual adjustments");
  }

  if (!adjustmentJournal || adjustmentJournal.skip) {
    throw new Error("Adjustment journal is required");
  }

  // ── 1. Update fund balance atomically ───────────────────────────
  const delta = direction === "in" ? numericAmount : -numericAmount;

  const fund = await financialFundsModel.findOneAndUpdate(
    { _id: fundId, companyId },
    { $inc: { fundBalance: delta } },
    { new: true, session }
  );

  if (!fund) throw new Error("Fund not found");

  // ── 2. Insert the report row ────────────────────────────────────
  await reportsFinancialFunds.create(
    [
      {
        date: date || new Date(),
        amount: numericAmount,
        direction,
        source: "manual_adjustment",
        refType: "manual",
        refId: fund._id,
        payment: null,
        financialFundId: fund._id,
        financialFundRest: fund.fundBalance,
        description,
        createdBy: req.user?._id || null,
        companyId,
      },
    ],
    { session }
  );

  // ── 3. Save the journal ─────────────────────────────────────────
  const nextCounterJournal = await counterModel.findOneAndUpdate(
    { companyId, name: "Journal" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session }
  );
  console.log("nextCounterJournal", nextCounterJournal);
  await createJournalEntryService({
    data: {
      ...adjustmentJournal.journalMeta,
      journalAccounts: adjustmentJournal.journalAccounts,
      counter: journalCounter || 0,
      refId: fund._id,
      refCounter: fund.counter || "",
    },
    companyId,
    nextCounterJournal,
    session,
  });

  return {
    fund,
    adjustment: {
      amount: numericAmount,
      direction,
      date,
      description,
    },
  };
};

exports.findOneFundAndBankService = async ({ req, companyId }) => {
  const { id } = req.params;

  const fundAndBank = await financialFundsModel
    .findOne({
      _id: id,
      companyId,
    })
    .populate({
      path: "fundCurrency",
      select: "_id currencyCode currencyName exchangeRate",
    })
    .populate("linkAccount")
    .populate({
      path: "linkAccount",
      populate: { path: "currency" },
    });

  if (!fundAndBank) {
    throw new ApiError(`No fundAndBank invoice for this id ${id}`, 404);
  }

  return { fundAndBank };
};

exports.updateFundAndBankService = async ({ req, companyId, session }) => {
  const { id } = req.params;

  const fundAndBank = await financialFundsModel
    .findOneAndUpdate(
      {
        _id: id,
        companyId,
      },
      req.body,
      { new: true }
    )
    .session(session);

  if (!fundAndBank) {
    throw new ApiError(`No fund and bank for this id ${id}`, 404);
  }

  return fundAndBank;
};

exports.deleteFundAndBankService = async ({ req, companyId, session }) => {
  const { id } = req.params;

  const ReportsFinancialFunds = await reportsFinancialFunds
    .countDocuments({
      financialFundId: id,
      companyId,
    })
    .session(session);
  let fundAndBank;
  if (ReportsFinancialFunds <= 1) {
    fundAndBank = await financialFundsModel
      .findOneAndDelete({
        _id: id,
        companyId,
      })
      .session(session);
    if (!fundAndBank) {
      throw new ApiError(`No fund and bank for this id ${id}`, 404);
    }
    return true;
  } else {
    return false;
  }
};

exports.findSpecificFundReportsService = async ({
  fundId,
  companyId,
  startDate,
  endDate,
  page = 1,
  limit = 0,
}) => {
  // ── Step 1: load full history (oldest first) for running balance ─
  // Running balance is computed from history because the per-row
  // snapshot is a helper, not source of truth.
  const allRows = await reportsFinancialFunds
    .find({
      financialFundId: fundId,
      companyId,
      archives: { $ne: true },
    })
    .sort({ date: 1, createdAt: 1 });

  let runningBalance = 0;
  const rowsWithBalance = allRows.map((row) => {
    const amount = Number(row.amount) || 0;
    runningBalance += row.direction === "out" ? -amount : amount;
    return { ...row.toObject(), runningBalance };
  });

  const fundBalance = runningBalance;

  // ── Step 2: apply date filter AFTER balance computation ─────────
  let filtered = rowsWithBalance;
  if (startDate && endDate) {
    const from = new Date(startDate + "T00:00:00.000Z");
    const to = new Date(endDate + "T23:59:59.999Z");
    filtered = filtered.filter((r) => {
      const d = new Date(r.date);
      return d >= from && d <= to;
    });
  }

  // ── Step 3: sort descending for display ──────────────────────────
  filtered.sort((a, b) => {
    const dateDiff = new Date(b.date) - new Date(a.date);
    if (dateDiff !== 0) return dateDiff;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  // ── Step 4: paginate ─────────────────────────────────────────────
  const totalItems = filtered.length;
  const pageSize = Number(limit) || 0;
  const skip = (Number(page) - 1) * pageSize;
  const paginated = pageSize ? filtered.slice(skip, skip + pageSize) : filtered;
  const totalPages = pageSize ? Math.ceil(totalItems / pageSize) : 1;

  return {
    reports: paginated,
    totalPages,
    totalItems,
    fundBalance,
  };
};

exports.getFundAndBankForSalesPointService = async ({
  req,
  companyId,
  session,
}) => {
  const { id } = req.params;

  const salesPoint = await salesPointModel.findOne({ _id: id, companyId });
  if (!salesPoint) {
    return res.status(404).json({ message: "Sales point not found" });
  }
  const funds = await Promise.all(
    salesPoint.funds.map(async (fundItem) => {
      return financialFundsModel
        .findOne({
          _id: fundItem.id,
          companyId,
        })
        .populate({
          path: "fundCurrency",
          select: "_id currencyCode currencyName exchangeRate",
        });
    })
  );

  return funds;
};
