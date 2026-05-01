const paymentsModel = require("../../../models/Accounting/CurrentAssets/payments.model");
const journalEntriesModel = require("../../../models/Accounting/journalEntries/journalEntries.model");
const accountingTreeModel = require("../../../models/accountingTreeModel");
const expensesModel = require("../../../models/expensesModel");
const orderModel = require("../../../models/orderModel");
const purchaseinvoicesModel = require("../../../models/purchaseinvoicesModel");
const refundPurchaseInviceModel = require("../../../models/refundPurchaseInviceModel");
const periodicJournalEntriesModel = require("../../../models/reports/periodicJournalEntriesModel");
const returnOrderModel = require("../../../models/returnOrderModel");

exports.journalEntriesService = async ({ req, companyId }) => {
  const pageSize = req.query.limit || 0;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * pageSize;
  const { startDate, endDate } = req.query;

  let query = { companyId };
  if (startDate && endDate) {
    query.journalDate = {
      $gte: new Date(startDate + "T00:00:00.000Z"),
      $lte: new Date(endDate + "T23:59:59.999Z"),
    };
  }

  if (req.query.keyword) {
    query.$or = [
      { journalName: { $regex: req.query.keyword, $options: "i" } },
      { journalRefNum: { $regex: req.query.keyword, $options: "i" } },
      { counter: { $regex: req.query.keyword, $options: "i" } },
      { journalDesc: { $regex: req.query.keyword, $options: "i" } },
    ];
  }
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
  req,
  companyId,
  nextCounterJournal,
  session,
}) => {
  req.body.companyId = companyId;

  req.body.counter = Number(req.body.counter) + nextCounterJournal.seq;
  req.body.journalRefNum = req.body.counter;

  function padZero(value) {
    return value < 10 ? `0${value}` : value;
  }

  if (typeof req.body.journalAccounts === "string") {
    req.body.journalAccounts = JSON.parse(req.body.journalAccounts);
  }
  const ts = Date.now();
  const date_ob = new Date(ts);
  const formattedDateAdd = `${padZero(date_ob.getHours())}:${padZero(
    date_ob.getMinutes(),
  )}:${padZero(date_ob.getSeconds())}.${padZero(date_ob.getMilliseconds(), 3)}`;
  const isoDate = `${req.body.journalDate}T${formattedDateAdd}Z`;

  req.body.journalDate = isoDate;
  req.body.filesArray = req.body.filesArray || [];
  let create;

  create = await journalEntriesModel.create([{ ...req.body }], {
    session,
  });
  create = create[0];

  const updateOperations = req.body.journalAccounts.map((item) => ({
    updateOne: {
      filter: { _id: item.id },
      update: {
        $inc: {
          debtor: item.MainDebit || 0,
          creditor: item.MainCredit || 0,
        },
      },
    },
  }));
  await accountingTreeModel.bulkWrite(updateOperations, { session });

  return create;
};

exports.createJournalServiceV2 = async ({
  journalInfo,
  journalAccounts,
  companyId,
  session,
  nextCounterJournal,
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

  const padZero = (value) => (value < 10 ? `0${value}` : value);

  const ts = Date.now();
  const dateOb = new Date(ts);
  const formattedTime = `${padZero(dateOb.getHours())}:${padZero(
    dateOb.getMinutes(),
  )}:${padZero(dateOb.getSeconds())}.${String(
    dateOb.getMilliseconds(),
  ).padStart(3, "0")}`;

  const isoJournalDate = `${journalInfo.journalDate}T${formattedTime}Z`;

  const totalJournalDebit = journalAccounts.reduce(
    (sum, account) => sum + Number(account.MainDebit || 0),
    0,
  );

  const totalJournalCredit = journalAccounts.reduce(
    (sum, account) => sum + Number(account.MainCredit || 0),
    0,
  );

  const payload = {
    ...journalInfo,
    companyId,
    journalDate: isoJournalDate,
    journalAccounts,
    filesArray: journalInfo.filesArray || [],
    counter: Number(journalInfo.counter || 0) + nextCounterJournal.seq,
    journalRefNum: nextCounterJournal.seq,
    journalDebit: totalJournalDebit,
    journalCredit: totalJournalCredit,
  };

  const [createdJournal] = await journalModel.create([payload], { session });

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

  await existingPeriodicService({
    journalDate: isoJournalDate,
    journalAccounts,
    companyId,
    session,
  });

  return createdJournal;
};

exports.auditingJournalService = async ({ companyId, session }) => {
  const { id } = req.params;
  const { auditing } = req.body;

  const journal = await journalEntriesModel.findOneAndUpdate(
    { _id: id, companyId },
    { auditing: auditing },
    { new: true, session },
  );

  if (journal.journalType === "Sales") {
    await orderModel.findOneAndUpdate(
      {
        journalCounter: journal.linkCounter,
        companyId,
      },
      { auditing: auditing },
      { new: true, session },
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
      { new: true, session },
    );
  } else if (journal.journalType === "Expense") {
    await expensesModel.findOneAndUpdate(
      {
        journalCounter: journal.linkCounter,
        companyId,
      },
      { auditing: auditing },
      { new: true, session },
    );
  } else if (journal.journalType === "Purchase") {
    await purchaseinvoicesModel.findOneAndUpdate(
      {
        journalCounter: journal.linkCounter,
        companyId,
      },
      { auditing: auditing },
      { new: true, session },
    );
  } else if (journal.journalType === "SalesRefund") {
    await returnOrderModel.findOneAndUpdate(
      {
        journalCounter: journal.linkCounter,
        companyId,
      },
      { auditing: auditing },
      { new: true, session },
    );
  } else if (journal.journalType === "PurchaseRefund") {
    await refundPurchaseInviceModel.findOneAndUpdate(
      {
        journalCounter: journal.linkCounter,
        companyId,
      },
      { auditing: auditing },
      { new: true, session },
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
    return next(new ApiError(`no journal by linkNum ${linkNum}`, 404));
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
      { session },
    );

    if (existingPeriodic) {
      const existingMonth = existingPeriodic.months.find(
        (x) => x.month === monthName,
      );

      if (existingMonth) {
        existingMonth.amount += monthAmount;
      } else {
        existingPeriodic.months.push({ month: monthName, amount: monthAmount });
      }

      existingPeriodic.yearTotal = existingPeriodic.months.reduce(
        (sum, mo) => sum + (mo.amount || 0),
        0,
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
