const paymentsModel = require("../../../models/Accounting/CurrentAssets/payments.model");
const journalEntriesModel = require("../../../models/journalEntryModel");
const accountingTreeModel = require("../../../models/accountingTreeModel");
const expensesModel = require("../../../models/expensesModel");
const orderModel = require("../../../models/orderModel");
const purchaseinvoicesModel = require("../../../models/purchaseinvoicesModel");
const refundPurchaseInviceModel = require("../../../models/refundPurchaseInviceModel");
const periodicJournalEntriesModel = require("../../../models/reports/periodicJournalEntriesModel");
const returnOrderModel = require("../../../models/returnOrderModel");
const counterModel = require("../../../models/Settings/counterModel");
const reconciliationModel = require("../../../models/reconciliationModel");

const validateJournalData = ({ journalAccounts, journalDate, journalMeta }) => {
  if (!journalDate) {
    throw new Error("Journal date is required");
  }

  if (!Array.isArray(journalAccounts) || journalAccounts.length === 0) {
    throw new Error("Journal must have at least one account entry");
  }

  // no undefined account ids
  const hasUndefinedAccount = journalAccounts.some(
    (acc) => !acc.id && !acc._id
  );
  if (hasUndefinedAccount) {
    throw new Error("All journal entries must have a valid account id");
  }

  // debit must equal credit
  const totalDebit = journalAccounts.reduce(
    (sum, acc) => sum + Number(acc.MainDebit || 0),
    0
  );
  const totalCredit = journalAccounts.reduce(
    (sum, acc) => sum + Number(acc.MainCredit || 0),
    0
  );

  const diff = Math.abs(totalDebit - totalCredit);
  if (diff > 0.01) {
    throw new Error(
      `Journal is not balanced — Debit: ${totalDebit.toFixed(
        4
      )}, Credit: ${totalCredit.toFixed(4)}, Diff: ${diff.toFixed(4)}`
    );
  }

  return { totalDebit, totalCredit };
};

exports.journalEntriesService = async ({ req, companyId }) => {
  const pageSize = req.query.limit || 0;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * pageSize;
  const { startDate, endDate } = req.query;

  let query = { companyId };
  // if (startDate && endDate) {
  //   query.journalDate = {
  //     $gte: new Date(startDate + "T00:00:00.000Z"),
  //     $lte: new Date(endDate + "T23:59:59.999Z"),
  //   };
  // }

  // if (req.query.keyword) {
  //   query.$or = [
  //     { journalName: { $regex: req.query.keyword, $options: "i" } },
  //     { journalRefNum: { $regex: req.query.keyword, $options: "i" } },
  //     { counter: { $regex: req.query.keyword, $options: "i" } },
  //     { journalDesc: { $regex: req.query.keyword, $options: "i" } },
  //   ];
  // }
  const totalItems = await journalEntriesModel.countDocuments(query);

  // Calculate total pages
  const totalPages = Math.ceil(totalItems / pageSize);

  const account = await journalEntriesModel
    .find(query)
    .sort({ journalDate: -1 })
    .skip(skip)
    .limit(pageSize);

  return { totalItems, totalPages, account };
};

exports.getOneJournalService = async ({ req, companyId }) => {
  const { id } = req.params;

  const account = await journalEntriesModel.findOne({ _id: id, companyId });
  if (!account) {
    return next(new ApiError(`not find Transaction in this id: ${id}`, 404));
  }
  return { account };
};

exports.createJournalEntryService = async ({
  req, // ← provided by standalone route
  data, // ← provided by internal controller calls
  companyId,
  nextCounterJournal,
  session,
}) => {
  // ── Resolve source ─────────────────────────────────────────────
  // data takes priority — internal calls pass clean plain objects
  // req.body is used for manual journal route
  const body = data || req?.body;

  if (!body) throw new Error("Journal data is required");

  const padZero = (value) => (value < 10 ? `0${value}` : String(value));

  // ── Build ISO date ─────────────────────────────────────────────
  const ts = Date.now();
  const date_ob = new Date(ts);
  const formattedTime = `${padZero(date_ob.getHours())}:${padZero(
    date_ob.getMinutes()
  )}:${padZero(date_ob.getSeconds())}.${String(
    date_ob.getMilliseconds()
  ).padStart(3, "0")}`;
  const isoDate = body.journalDate?.includes("T")
    ? body.journalDate
    : `${body.journalDate}T${formattedTime}Z`;

  // ── Parse accounts if string (form-data from UI) ──────────────
  const journalAccounts =
    typeof body.journalAccounts === "string"
      ? JSON.parse(body.journalAccounts)
      : body.journalAccounts || [];

  // ── Counter ────────────────────────────────────────────────────
  const counter = Number(body.counter || 0) + nextCounterJournal.seq;
  console.log("body", body);
  // ── Validate ───────────────────────────────────────────────────
  validateJournalData({
    journalDate: body.journalDate,
    journalAccounts,
  });

  // ── Build journal payload ──────────────────────────────────────
  const journalPayload = {
    companyId,
    counter,
    journalRefNum: counter,
    journalName: body.journalName || "",
    journalDate: isoDate,
    journalDesc: body.journalDesc || "",
    journalType: body.journalType || "",
    linkCounter: body.linkCounter || "",
    refCounter: body.refCounter || "",
    refId: body.refId || null,
    party: body.party || null,
    receiptNumber: body.receiptNumber || "",
    filesArray: body.filesArray || [],
    sync: false,
    journalAccounts,
    journalDebit: journalAccounts.reduce(
      (s, a) => s + Number(a.MainDebit || 0),
      0
    ),
    journalCredit: journalAccounts.reduce(
      (s, a) => s + Number(a.MainCredit || 0),
      0
    ),
  };

  // ── Create journal entry ───────────────────────────────────────
  const created = await journalEntriesModel.create([journalPayload], {
    session,
  });
  const newJournal = created[0];

  // ── Update account balances ────────────────────────────────────
  const updateOperations = journalAccounts.map((item) => ({
    updateOne: {
      filter: { _id: item.id || item._id },
      update: {
        $inc: {
          debtor: Number(item.MainDebit || 0),
          creditor: Number(item.MainCredit || 0),
        },
      },
    },
  }));

  if (updateOperations.length > 0) {
    await accountingTreeModel.bulkWrite(updateOperations, { session });
  }

  return newJournal;
};

exports.createJournalServiceV2 = async ({
  journalInfo,
  journalAccounts,
  companyId,
  session,
  totalDebit,
  totalCredit,
}) => {
  if (!companyId) {
    throw new ApiError("companyId is required", 400);
  }

  if (!journalInfo) {
    throw new ApiError("journalInfo is required", 400);
  }

  if (!Array.isArray(journalAccounts) || journalAccounts.length === 0) {
    throw new ApiError("journalAccounts are required", 400);
  }

  const nextCounterJournal = await counterModel.findOneAndUpdate(
    { companyId, name: "Journal" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session }
  );

  const padZero = (value) => (value < 10 ? `0${value}` : value);

  const ts = Date.now();
  const dateOb = new Date(ts);
  const formattedTime = `${padZero(dateOb.getHours())}:${padZero(
    dateOb.getMinutes()
  )}:${padZero(dateOb.getSeconds())}.${String(
    dateOb.getMilliseconds()
  ).padStart(3, "0")}`;

  const isoJournalDate = `${journalInfo.journalDate}T${formattedTime}Z`;

  const payload = {
    ...journalInfo,
    companyId,
    journalDate: isoJournalDate,
    journalAccounts,
    filesArray: journalInfo.filesArray || [],
    counter: Number(journalInfo.counter || 0) + nextCounterJournal.seq,
    journalRefNum: nextCounterJournal.seq,
    journalDebit: totalDebit,
    journalCredit: totalCredit,
  };

  const [createdJournal] = await journalEntriesModel.create([payload], {
    session,
  });

  const updateOperations = journalAccounts.map((item) => ({
    updateOne: {
      filter: { _id: item.id, companyId },
      update: {
        $inc: {
          debtor: Number(item.MainDebit || 0),
          creditor: Number(item.MainCredit || 0),
        },
      },
    },
  }));

  if (updateOperations.length > 0) {
    await accountingTreeModel.bulkWrite(updateOperations, { session });
  }

  // await existingPeriodicService({
  //   journalDate: isoJournalDate,
  //   journalAccounts,
  //   companyId,
  //   session,
  // });

  return createdJournal;
};

exports.auditingJournalService = async ({ companyId, session }) => {
  const { id } = req.params;
  const { auditing } = req.body;

  const journal = await journalEntriesModel.findOneAndUpdate(
    { _id: id, companyId },
    { auditing: auditing },
    { new: true, session }
  );

  if (journal.journalType === "Sales") {
    await orderModel.findOneAndUpdate(
      {
        journalCounter: journal.linkCounter,
        companyId,
      },
      { auditing: auditing },
      { new: true, session }
    );
  } else if (
    journal.journalType === "Payment In" ||
    journal.journalType === "Payment Out"
  ) {
    await paymentsModel.findOneAndUpdate(
      {
        journalCounter: journal.linkCounter,
        companyId,
      },
      { auditing: auditing },
      { new: true, session }
    );
  } else if (journal.journalType === "Expense") {
    await expensesModel.findOneAndUpdate(
      {
        journalCounter: journal.linkCounter,
        companyId,
      },
      { auditing: auditing },
      { new: true, session }
    );
  } else if (journal.journalType === "Purchase") {
    await purchaseinvoicesModel.findOneAndUpdate(
      {
        journalCounter: journal.linkCounter,
        companyId,
      },
      { auditing: auditing },
      { new: true, session }
    );
  } else if (journal.journalType === "SalesRefund") {
    await returnOrderModel.findOneAndUpdate(
      {
        journalCounter: journal.linkCounter,
        companyId,
      },
      { auditing: auditing },
      { new: true, session }
    );
  } else if (journal.journalType === "PurchaseRefund") {
    await refundPurchaseInviceModel.findOneAndUpdate(
      {
        journalCounter: journal.linkCounter,
        companyId,
      },
      { auditing: auditing },
      { new: true, session }
    );
  }

  return journal;
};

exports.getOneJournalByLinkServices = async ({ req, companyId }) => {
  const { linkNum } = req.params;

  const journal = await journalEntriesModel.findOne({
    linkCounter: linkNum,
    companyId,
  });

  if (!journal) {
    throw new ApiError(`no journal by linkNum ${linkNum}`, 404); // ← throw
  }

  return { data: journal };
};

exports.existingPeriodicService = async ({
  journalDate,
  journalAccounts,
  companyId,
  session,
}) => {
  const MONTHS = [
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
  for (const item of journalAccounts) {
    const date = new Date(journalDate);
    const year = date.getFullYear();
    const monthName = MONTHS[date.getMonth()];

    const monthAmount = (item.MainDebit || 0) - (item.MainCredit || 0);

    const existingPeriodic = await periodicJournalEntriesModel.findOne(
      {
        accountId: item.id,
        year,
        companyId,
      },
      null,
      { session }
    );

    if (existingPeriodic) {
      const existingMonth = existingPeriodic.months.find(
        (x) => x.month === monthName
      );

      if (existingMonth) {
        existingMonth.amount += monthAmount;
      } else {
        existingPeriodic.months.push({ month: monthName, amount: monthAmount });
      }

      existingPeriodic.yearTotal = existingPeriodic.months.reduce(
        (sum, mo) => sum + (mo.amount || 0),
        0
      );

      await existingPeriodic.save(session);
    } else {
      const newPeriodic = new periodicJournalEntriesModel({
        name: item.name || "",
        year: year,

        months: [
          {
            month: monthName,
            amount: monthAmount || 0,
          },
        ],

        accountId: item.id,
        companyId,
        yearTotal: monthAmount || 0,
        parentId: item.parentId || null,
        parentCode: item.parentCode || null,
        code: item.code || "",
      });

      await newPeriodic.save(session);
    }
  }
  return { message: "Periodic entries updated successfully" };
};

exports.getOneAccountAndJournalService = async ({
  companyId,
  id,
  limit,
  page,
  keyword,
  filters = {},
  gotoLastMatched = false,
}) => {
  const pageSize = parseInt(limit, 10) || 10;
  let currentPage = parseInt(page, 10) || 1;

  // ── Fetch account ──────────────────────────────────────────────
  const account = await accountingTreeModel
    .findOne({ _id: id, companyId })
    .populate("currency")
    .lean();

  if (!account) throw new ApiError("Account not found", 404);

  // ── Build query ────────────────────────────────────────────────
  const query = { companyId, "journalAccounts.id": id };

  if (filters.partyId) query.party = filters.partyId;
  if (filters.journalType) query.journalType = filters.journalType;
  if (filters.auditing) query.auditing = filters.auditing;

  if (filters.startDate || filters.endDate) {
    query.journalDate = {};
    if (filters.startDate)
      query.journalDate.$gte = `${filters.startDate}T00:00:00.000Z`;
    if (filters.endDate)
      query.journalDate.$lte = `${filters.endDate}T23:59:59.999Z`;
  }

  if (keyword) {
    query.$or = [
      { journalName: { $regex: keyword, $options: "i" } },
      { journalRefNum: { $regex: keyword, $options: "i" } },
      { counter: { $regex: keyword, $options: "i" } },
      { refCounter: { $regex: keyword, $options: "i" } },
    ];
  }

  // ── Fetch all matching journals (for running balance) ──────────
  const totalItems = await journalEntriesModel.countDocuments(query);
  const totalPages = Math.ceil(totalItems / pageSize);
  const allJournals = await journalEntriesModel.find(query).lean();

  // ── Fetch reconciliations ──────────────────────────────────────
  const reconciliations = await reconciliationModel
    .find({ companyId })
    .sort({ createdAt: -1 })
    .select("journalLineCounter journalEntryId desc matchedBy matchedAt")
    .lean();

  const reconciliationMap = {};
  reconciliations.forEach((rec) => {
    reconciliationMap[rec.journalLineCounter] = rec;
  });

  // ── Go to last matched page ────────────────────────────────────
  if (gotoLastMatched && reconciliations.length > 0) {
    const lastRec = reconciliations[0];
    const beforeDash = lastRec.journalLineCounter?.split("-")[0];

    if (beforeDash) {
      const lastJournal = await journalEntriesModel
        .findOne({ counter: beforeDash, companyId })
        .lean();

      if (lastJournal) {
        const sorted = [...allJournals].sort(
          (a, b) => new Date(b.journalDate) - new Date(a.journalDate)
        );
        const index = sorted.findIndex(
          (j) => j._id.toString() === lastJournal._id.toString()
        );
        currentPage = index >= 0 ? Math.floor(index / pageSize) + 1 : 1;
      } else {
        currentPage = 1;
      }
    } else {
      currentPage = 1;
    }
  }

  // ── Build running balance ──────────────────────────────────────
  let runningBalanceMaine = 0;
  let runningBalance = 0;
  let totalDebtor = 0;
  let totalCreditor = 0;

  const filteredJournals = allJournals
    .sort((a, b) => new Date(a.journalDate) - new Date(b.journalDate))
    .map((journal) => {
      const filteredAccounts = (journal.journalAccounts || [])
        .filter((acc) => {
          let match =
            acc.id?.toString() === id.toString() && acc.posted !== false;
          if (filters.currency) {
            match =
              match && acc.accountCurrency?.toString() === filters.currency;
          }
          return match;
        })
        .map((accEntry) => {
          const mainDebit = Number(accEntry.MainDebit || 0);
          const mainCredit = Number(accEntry.MainCredit || 0);
          const accountDebit = Number(accEntry.accountDebit || 0);
          const accountCredit = Number(accEntry.accountCredit || 0);

          runningBalanceMaine +=
            account.balanceType === "credit"
              ? mainCredit - mainDebit
              : mainDebit - mainCredit;

          totalDebtor += mainDebit;
          totalCreditor += mainCredit;

          // runningBalance always in account currency
          runningBalance +=
            account.balanceType === "credit"
              ? accountCredit - accountDebit
              : accountDebit - accountCredit;

          const reconciliationInfo =
            reconciliationMap[`${journal.counter}-${accEntry.counter}`] || null;

          return {
            ...accEntry,
            runningBalanceMaine,
            runningBalance,
            reconciliation: reconciliationInfo,
          };
        });

      return {
        ...journal,
        journalAccounts: filteredAccounts,
        runningBalanceMaine,
        runningBalance,
        totalDebtor,
        totalCreditor,
      };
    })
    .filter((journal) => journal.journalAccounts.length > 0);

  // ── Paginate ───────────────────────────────────────────────────
  const skip = (currentPage - 1) * pageSize;

  const paginatedJournals = filteredJournals
    .sort((a, b) => new Date(b.journalDate) - new Date(a.journalDate))
    .slice(skip, skip + pageSize);

  return {
    pages: totalPages,
    results: totalItems,
    currentPage,
    runningBalanceMaine,
    runningBalance,
    totalDebtor,
    totalCreditor,
    data: account,
    journals: paginatedJournals,
  };
};
