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
