const expensesModel = require("../../../models/Accounting/Expenses/expensesModel");
const financialFundsModel = require("../../../models/Accounting/CurrentAssets/financialFundsModel");
const invoiceHistoryModel = require("../../../models/invoiceHistoryModel");
const journalEntryModel = require("../../../models/Accounting/JournalEntries/journalEntries.model");
const paymentModel = require("../../../models/Accounting/CurrentAssets/payments.model");
const purchaseinvoicesModel = require("../../../models/Accounting/Purchase/purchaseinvoicesModel");
const reportsFinancialFunds = require("../../../models/Accounting/CurrentAssets/reportsFinancialFunds");
const suppliersModel = require("../../../models/Accounting/Purchase/suppliersModel");
const ApiError = require("../../../utils/apiError");
const { createInvoiceHistory } = require("../../invoiceHistoryService");

const { createPaymentHistoryV2 } = require("../../paymentHistoryService");
const multer = require("multer");
const paymentsModel = require("../../../models/Accounting/CurrentAssets/payments.model");
const { getNextCounterValue } = require("../../../utils/getNextCounterValue");
const {
  createJournalEntryService,
} = require("../JournalEntries/journalEntries.Service");
const counterModel = require("../../../models/Settings/counterModel");

const multerStorage = multer.diskStorage({
  destination: function (req, file, callback) {
    // Specify the destination folder for storing the files
    callback(null, "./uploads/invoice");
  },
  filename: function (req, file, callback) {
    // Specify the filename for the uploaded file
    const originalname = file.originalname;
    const lastDotIndex = originalname.lastIndexOf(".");
    const fileExtension =
      lastDotIndex !== -1 ? originalname.slice(lastDotIndex + 1) : "";
    const filename = `file-${Date.now()}.${fileExtension}`;

    callback(null, filename);
  },
});

const upload = multer({
  storage: multerStorage,
  fileFilter: (req, file, callback) => {
    const allowedMimes = ["image/jpeg", "image/png", "application/pdf"];
    if (allowedMimes.includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(
        new ApiError("Invalid file type. Only images and PDFs are allowed."),
      );
    }
  },
});

const resolveInvoiceDate = (existingDate, incomingDate) => {
  if (!incomingDate) return existingDate;

  const existingDateOnly = existingDate
    ? new Date(existingDate).toISOString().split("T")[0]
    : null;

  const incomingDateObj = new Date(incomingDate);

  if (Number.isNaN(incomingDateObj.getTime())) {
    return existingDate;
  }

  const incomingDateOnly = incomingDateObj.toISOString().split("T")[0];

  return existingDateOnly === incomingDateOnly
    ? existingDate
    : incomingDateObj.toISOString();
};

exports.uploadFile = upload.single("expenseFile");

exports.prepareExpensesDataService = async ({
  req,
  companyId,
  session,
  isCash = false,
}) => {
  const padZero = (value, digits = 2) => String(value).padStart(digits, "0");

  const ts = Date.now();

  // payment date gets +1 second so it's always after invoice date
  const futureDateOb = new Date(ts);
  futureDateOb.setSeconds(futureDateOb.getSeconds() + 1);
  const futureFormattedDate = `${padZero(futureDateOb.getHours())}:${padZero(
    futureDateOb.getMinutes(),
  )}:${padZero(futureDateOb.getSeconds())}.${padZero(
    futureDateOb.getMilliseconds(),
    3,
  )}`;

  const date_ob = new Date(ts);
  const formattedDate = `${padZero(date_ob.getHours())}:${padZero(
    date_ob.getMinutes(),
  )}:${padZero(date_ob.getSeconds())}.${padZero(date_ob.getMilliseconds(), 3)}`;

  // mutate req.body dates to ISO format
  req.body.paymentDate = `${req.body.paymentDate}T${futureFormattedDate}Z`;
  req.body.date = `${req.body.date}T${formattedDate}Z`;

  // ── Parse body fields ─────────────────────────────────────────
  const supllierObject = req.body.supplier
    ? JSON.parse(req.body.supplier)
    : null;

  const taxDetails = req.body.taxDetails ? JSON.parse(req.body.taxDetails) : "";

  const categorts = req.body.categorts ? JSON.parse(req.body.categorts) : "";

  const currency = req.body.currency ? JSON.parse(req.body.currency) : "";

  const tag = req.body.tag ? JSON.parse(req.body.tag) : "";

  const draftJournalSnapshot = req.body.draftJournalSnapshot
    ? typeof req.body.draftJournalSnapshot === "string"
      ? JSON.parse(req.body.draftJournalSnapshot)
      : req.body.draftJournalSnapshot
    : null;

  // ── Supplier — skip for cash expenses ─────────────────────────
  // isCash = true  → no supplier involved, skip DB query
  // isCash = false → fetch supplier by id
  const supplier =
    !isCash && supllierObject?.id
      ? await suppliersModel
          .findOne({ _id: supllierObject.id, companyId })
          .session(session)
      : null;

  return {
    supplier,
    categorts,
    supllierObject,
    taxDetails,
    currency,
    tag,
    formattedDate,
    draftJournalSnapshot,
  };
};

exports.createExpensesInvoiceRecordService = async ({
  req,
  invoiceDraft,
  supplier,
  supllierObject,
  currency,
  taxDetails,
  tag,
  formattedDate,
  companyId,
  nextCounterPayment,
  draftJournalSnapshot,
  nextCounterExpensesInvoices,
  session,
  categorts,
}) => {
  const {
    expenseName,
    date,
    expenceTotal,
    expenceTaxTotal,
    expenceTotalMainCurrency,
    receiptNumber,
    mainCurrencyTax,
    paymentStatus,
    expenseClarification,
    totalRemainder,
    totalRemainderMainCurrency,
    journalCounter,
  } = req.body;

  const addSeconds = (dateValue, seconds = 0) => {
    const d = new Date(dateValue || new Date());
    d.setSeconds(d.getSeconds() + seconds);
    return d;
  };

  const paymentTransactionDate = addSeconds(
    req.body.paymentDate || req.body.date || formattedDate,
    5,
  );

  // ── Invoice totals ─────────────────────────────────────────────
  const invoiceTotalMain = Number(expenceTotalMainCurrency || 0);
  const invoiceTotalInvoice = Number(expenceTotal || 0);

  // ── Always create with FULL remainder — handler owns paid status
  // Draft  → keep what frontend sent (may be partial)
  // Posted → full amount, handleExpensePayment will reduce it
  const invoicePayload = {
    employee: req.user._id,
    employeeID: invoiceDraft ? null : req.user._id,
    employeeName: invoiceDraft ? null : req.user.name,
    supllier: supllierObject,
    currency,
    taxDetails,
    expenseName,
    tag,
    companyId,
    date: date || formattedDate,
    journalCounter,
    file: req.body.file,
    paymentDate: paymentTransactionDate,

    // posted → always unpaid + full remainder
    // handler sets paid + zeroes remainder after payment
    paymentStatus: "unpaid",
    totalRemainder: invoiceDraft ? totalRemainder : invoiceTotalInvoice,
    totalRemainderMainCurrency: invoiceDraft
      ? totalRemainderMainCurrency
      : invoiceTotalMain,

    expenceTotal,
    expenceTaxTotal,
    expenceTotalMainCurrency,
    receiptNumber,
    mainCurrencyTax,
    expenseClarification,
    draftJournalSnapshot,
    categorts,
    isCash: req.body.isCash === "true" || req.body.isCash === true,

    type: "expense",
    status: invoiceDraft ? "draft" : "posted",
    isDraft: invoiceDraft,
    postedAt: invoiceDraft ? null : new Date(),
  };

  if (!invoiceDraft) {
    invoicePayload.counter =
      Number(req.body.counter || 0) + nextCounterExpensesInvoices.seq;

    // always set dueDate for posted invoices
    invoicePayload.dueDate = paymentTransactionDate;
  }

  if (invoiceDraft) {
    invoicePayload.isDraft = true;
    invoicePayload.draftJournalSnapshot = draftJournalSnapshot
      ? {
          ...draftJournalSnapshot,
          generatedAt: new Date(),
          source: draftJournalSnapshot?.source || "frontend",
        }
      : null;
  }

  /*
    =============================
    CREATE INVOICE
    =============================
  */
  const createdInvoice = await expensesModel.create([invoicePayload], {
    session,
  });

  const newExpenseInvoice = createdInvoice[0];

  /*
    =============================
    INVOICE HISTORY
    =============================
  */
  await createInvoiceHistory(
    companyId,
    newExpenseInvoice._id,
    "create",
    req.user._id,
    req.body.date || formattedDate,
    invoiceDraft ? "Expense invoice draft created" : "Expense invoice created",
    "expense",
    session,
  );

  return newExpenseInvoice;
};

exports.applyExpenseSupplierEffectsService = async ({
  supplier,
  newExpenseInvoice,
  companyId,
  currency,
  date,
  expenceTotalMainCurrency,
  totalRemainderMainCurrency,
  paymentStatus,
  session,
}) => {
  if (!supplier) {
    throw new ApiError("Supplier not found", 404);
  }

  const totalMain = Number(expenceTotalMainCurrency || 0);
  const remainderMain = Number(totalRemainderMainCurrency || 0);

  supplier.total += totalMain;

  supplier.TotalUnpaid += totalMain;

  await supplier.save({ session });

  await createPaymentHistoryV2({
    companyId,
    entryType: "expense",
    transactionDate: date,
    amountTransactionCurrency: newExpenseInvoice.expenceTotal,
    amountMainCurrency: totalMain,
    supplierId: supplier._id,
    referenceId: newExpenseInvoice._id,
    sourceModule: "expense",
    actionType: "create",
    transactionCurrency: currency.currencyCode,
    balanceEffectType: "Withdrawal",
    session,
  });
};

exports.findAllExpensesInvoicesService = async ({ req, companyId }) => {
  const filters = req.query?.filters ? JSON.parse(req.query?.filters) : {};

  const pageSize = Number(req.query.limit) || 20;
  const page = Number(req.query.page) || 1;
  const skip = (page - 1) * pageSize;

  const query = { companyId };

  if (filters?.startDate || filters?.endDate) {
    query.date = {};
    if (filters?.startDate) query.date.$gte = filters.startDate;
    if (filters?.endDate) query.date.$lte = filters.endDate;
  }

  if (filters?.tags?.length) {
    const tagIds = filters.tags.map((tag) => tag.id);
    query["tag.id"] = { $in: tagIds };
  }

  if (filters.paymentStatus) {
    query.paid = filters.paymentStatus;
  }

  if (filters.employee) {
    query.employee = filters.employee;
  }

  if (filters?.businessPartners) {
    query["supllier.name"] = {
      $regex: filters.businessPartners,
      $options: "i",
    };
  }

  if (req.query.keyword) {
    query.$or = [
      { "supllier.name": { $regex: req.query.keyword, $options: "i" } },
      { invoiceName: { $regex: req.query.keyword, $options: "i" } },
      { invoiceNumber: { $regex: req.query.keyword, $options: "i" } },
    ];
  }

  if (filters?.filterTags?.length) {
    query["tag.name"] = { $in: filters.filterTags };
  }

  const totalItems = await expensesModel.countDocuments(query);

  const totalPages = Math.ceil(totalItems / pageSize);
  const expenses = await expensesModel
    .find(query)
    .sort({ date: -1 })
    .skip(skip)
    .limit(pageSize);

  return {
    totalItems,
    totalPages,
    expenses,
  };
};

exports.findOneExpenseInvoiceService = async ({ req, companyId }) => {
  const { id } = req.params;

  const expense = await expensesModel.findOne({
    _id: id,
    companyId,
  });

  if (!expense) {
    throw new ApiError(`No expense invoice for this id ${id}`, 404);
  }

  const pageSize = Number(req.query.limit) || 20;
  const page = Number(req.query.page) || 1;
  const skip = (page - 1) * pageSize;

  const totalItems = await invoiceHistoryModel.countDocuments({
    invoiceId: id,
  });

  const totalPages = Math.ceil(totalItems / pageSize);
  const invoiceHistory = await invoiceHistoryModel
    .find({
      invoiceId: id,
      companyId,
    })
    .populate({ path: "employeeId", select: "name email" })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(pageSize);

  return {
    totalItems,
    totalPages,
    expense,
    invoiceHistory,
  };
};

exports.prepareExpenseDataFromDraftService = async ({
  expense,
  companyId,
  session,
}) => {
  const supllierObject = expense.supllier || {};
  const taxDetails = expense.taxDetails || [];
  const currency = expense.currency || {};
  const tag = expense.tag || [];

  const supplier = await suppliersModel
    .findOne({
      _id: supllierObject.id,
      companyId,
    })
    .session(session);

  return {
    supplier,
    supllierObject,
    taxDetails,
    currency,
    tag,
  };
};

const EXPENSE_SUPPLIER_REVERSAL_MODES = {
  CANCEL: "cancel",
  REVERSE_UPDATE: "reverse_update",
};
exports.reverseExpenseSupplierEffectsService = async ({
  supplier,
  expense,
  companyId,
  currency,
  session,
  cancellationDate,
  mode = EXPENSE_SUPPLIER_REVERSAL_MODES.CANCEL,
}) => {
  if (!supplier) {
    throw new ApiError("Supplier not found", 404);
  }

  const reversalConfig = {
    [EXPENSE_SUPPLIER_REVERSAL_MODES.CANCEL]: {
      actionType: "cancel",
      sourceLabel: "Expense invoice cancellation",
    },
    [EXPENSE_SUPPLIER_REVERSAL_MODES.REVERSE_UPDATE]: {
      actionType: "update",
      sourceLabel: "Expense invoice reverse update",
    },
  };

  const currentMode = reversalConfig[mode];

  if (!currentMode) {
    throw new ApiError(`Invalid supplier reversal mode: ${mode}`, 400);
  }

  const totalMain = Number(expense.expenceTotalMainCurrency || 0);

  await createPaymentHistoryV2({
    companyId,
    entryType: "expense",
    transactionDate: cancellationDate,
    amountTransactionCurrency: Number(expense.expenceTotal || 0),
    amountMainCurrency: totalMain,
    supplierId: supplier._id,
    referenceId: expense._id,
    sourceModule: "expense",
    actionType: currentMode.actionType,
    description: currentMode.sourceLabel,
    transactionCurrency: currency?.currencyCode || "",
    session,
  });
};

exports.reverseExpenseJournalEffectsService = async ({
  companyId,
  expense,
  session,
  counterFormat,
  cancellationDate,
  mode = "cancel",
}) => {
  if (!expense?.journalCounter) {
    throw new ApiError(
      "journal link reference is missing on expense invoice",
      400,
    );
  }

  const modeConfig = {
    cancel: {
      journalType: "Expense Reversal",
      journalNamePrefix: "Expense Invoice Cancellation",
      journalDescPrefix:
        "Journal entry created to reverse the accounting effect of the cancelled expense invoice",
      originalStatus: "reversed",
    },
    reverse_update: {
      journalType: "Expense Reverse Update",
      journalNamePrefix: "Expense Invoice Update Reversal",
      journalDescPrefix:
        "Journal entry created to reverse the previous accounting effect before reposting the updated expense invoice",
      originalStatus: "reversed",
    },
  };

  const currentMode = modeConfig[mode];
  if (!currentMode) {
    throw new ApiError(`Invalid journal reversal mode: ${mode}`, 400);
  }

  const originalJournal = await journalEntryModel
    .findOne({
      companyId,
      linkCounter: expense.journalCounter,
    })
    .session(session);

  if (!originalJournal) {
    throw new ApiError("original journal not found", 404);
  }

  if (originalJournal.status === "reversed") {
    throw new ApiError("original journal is already reversed", 400);
  }

  const originalLines = originalJournal.journalAccounts || [];

  if (!Array.isArray(originalLines) || originalLines.length === 0) {
    throw new ApiError("original journal accounts are missing", 400);
  }

  const reversedLines = originalLines.map((line, index) => {
    const plain = line.toObject ? line.toObject() : { ...(line._doc || line) };

    return {
      ...plain,
      MainDebit: Number(plain?.MainCredit || 0),
      MainCredit: Number(plain?.MainDebit || 0),
      accountDebit: Number(plain?.accountCredit || 0),
      accountCredit: Number(plain?.accountDebit || 0),
      counter: index + 1,
    };
  });

  const totalDebit = reversedLines.reduce(
    (sum, item) => sum + Number(item?.MainDebit || 0),
    0,
  );

  const totalCredit = reversedLines.reduce(
    (sum, item) => sum + Number(item?.MainCredit || 0),
    0,
  );

  if (Number(totalDebit.toFixed(6)) !== Number(totalCredit.toFixed(6))) {
    throw new ApiError(
      `reversal journal is not balanced. debit=${totalDebit}, credit=${totalCredit}`,
      400,
    );
  }

  const reversalJournalPayload = {
    journalName: `${currentMode.journalNamePrefix} - ${
      originalJournal?.journalName || expense?.invoiceName || ""
    }`,
    journalDate: cancellationDate,
    journalDesc: `${currentMode.journalDescPrefix} ${
      expense?.invoiceName || ""
    }`,
    journalType: currentMode.journalType,
    linkCounter: String(expense.journalCounter),
    refCounter: String(expense?.counter || ""),
    counter: counterFormat,
    refId: expense?._id,
    party: originalJournal?.party || expense?.supllier?.id || "",
    receiptNumber:
      originalJournal?.receiptNumber || expense?.invoiceNumber || "",
    filesArray: [],
    journalDebit: totalDebit,
    journalCredit: totalCredit,
  };

  const nextCounterJournal = await counterModel.findOneAndUpdate(
    { companyId, name: "Journal" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session },
  );

  const createdReversalJournal = await createJournalEntryService({
    data: {
      ...reversalJournalPayload,
      journalAccounts: reversedLines,
    },
    companyId,
    nextCounterJournal,
    session,
  });

  originalJournal.status = currentMode.originalStatus;
  originalJournal.reversedAt = cancellationDate;
  originalJournal.reverseJournalId = createdReversalJournal?._id || null;

  await originalJournal.save({ session });

  return {
    originalJournal,
    createdReversalJournal,
    reversalJournalPayload: {
      ...reversalJournalPayload,
      journalAccounts: reversedLines,
    },
  };
};

exports.upsertExpenseInvoiceRecordService = async ({
  mode = "create",
  req,
  existingInvoice = null,
  invoiceDraft,
  supplier,
  invoicesItem,
  supllierObject,
  currency,
  taxDetails,
  tag,
  formattedDate,
  companyId,
  nextCounterPayment,
  draftJournalSnapshot,
  nextCounterPurchaseInvoices,
  session,
}) => {
  const {
    paymentStatus,
    exchangeRate,
    totalInMainCurrency,
    invoiceSubTotal,
    subtotalWithDiscount,
    invoiceDiscount,
    InvoiceDiscountType,
    ManualInvoiceDiscount,
    ManualInvoiceDiscountValue,
    invoiceGrandTotal,
    invoiceName,
    invoiceTax,
    paymentInFundCurrency,
    invoiceNumber,
    journalCounter,
    paymentDate,
    description,
    totalRemainder,
    totalRemainderMainCurrency,
  } = req.body;

  let financialFund = null;
  let parsedFinancialFund = null;

  if (req.body.financailFund) {
    parsedFinancialFund =
      typeof req.body.financailFund === "string"
        ? JSON.parse(req.body.financailFund)
        : req.body.financailFund;
  }

  if (paymentStatus === "paid" && !invoiceDraft) {
    financialFund = await financialFundsModel
      .findOne({ _id: parsedFinancialFund?.id, companyId })
      .session(session);

    if (!financialFund) {
      throw new ApiError("Financial fund not found", 404);
    }

    financialFund.fundBalance -= Number(paymentInFundCurrency || 0);
  }

  const invoicePayload = {
    employee: req.user._id,
    invoicesItems: invoicesItem,
    supllier: supllierObject,
    currency,
    exchangeRate,
    invoiceNumber,
    paid: invoiceDraft ? "unpaid" : paid,
    totalPurchasePriceMainCurrency: totalInMainCurrency,
    invoiceSubTotal,
    subtotalWithDiscount,
    invoiceDiscount,
    InvoiceDiscountType,
    ManualInvoiceDiscount,
    ManualInvoiceDiscountValue,
    invoiceGrandTotal,
    taxDetails,
    invoiceTax,
    invoiceName,
    tag,
    companyId,
    date: req.body.date || formattedDate,
    journalCounter,
    description,
    file: req.body.file,
    paymentDate,
    totalRemainder,
    totalRemainderMainCurrency,
    type: "purchase",
    status: invoiceDraft ? "draft" : "posted",
    isDraft: invoiceDraft,
  };

  if (mode === "create" && !invoiceDraft) {
    invoicePayload.counter =
      Number(req.body.counter || 0) + nextCounterPurchaseInvoices.seq;
    invoicePayload.postedBy = req.user._id;
    invoicePayload.postedAt = new Date();
  }

  if (mode === "update") {
    invoicePayload.postedBy = existingInvoice?.postedBy || req.user._id;
    invoicePayload.postedAt = existingInvoice?.postedAt || new Date();
    invoicePayload.cancelledAt = null;
    invoicePayload.cancelledBy = null;
    invoicePayload.cancellationReason = "";
    invoicePayload.payments = [];
    invoicePayload.reportsBalanceId = null;
  }

  if (mode === "create" && invoiceDraft) {
    invoicePayload.draftJournalSnapshot = draftJournalSnapshot
      ? {
          ...draftJournalSnapshot,
          generatedAt: new Date(),
          source: draftJournalSnapshot?.source || "frontend",
        }
      : null;
  }

  if (paid === "paid" && !invoiceDraft) {
    invoicePayload.financailFund = parsedFinancialFund;
    invoicePayload.paymentInFundCurrency = paymentInFundCurrency;
  }

  if (paid === "unpaid") {
    invoicePayload.dueDate = paymentDate;
  }

  let invoiceDoc;

  if (mode === "create") {
    const createdInvoice = await PurchaseInvoicesModel.create(
      [invoicePayload],
      {
        session,
      },
    );
    invoiceDoc = createdInvoice[0];
  } else if (mode === "update") {
    if (!existingInvoice) {
      throw new ApiError("existingInvoice is required for update mode", 400);
    }

    Object.assign(existingInvoice, invoicePayload);
    await existingInvoice.save({ session });
    invoiceDoc = existingInvoice;
  } else {
    throw new ApiError("Invalid mode", 400);
  }

  if (paid === "paid" && !invoiceDraft) {
    const payment = await PaymentModel.create(
      [
        {
          source: {
            id: financialFund._id,
            name: financialFund.fundName,
          },
          destination: {
            id: supllierObject.id,
            name: supllierObject.name,
          },
          sourceType: "purchase", // keep old model for now
          destinationType: "fund",
          totalInPaymentCurrency: req.body.paymentInInvoiceCurrency,
          totalMainCurrency: req.body.paymentInMainCurrency,
          paymentInDestinationCurrency: req.body.paymentInFundCurrency,
          paymentCurrency: {
            id: currency?.id,
            name: currency?.name,
            code: currency?.currencyCode,
            exchangeRate: currency?.exchangeRate,
          },
          destinationExchangeRate: financialFund?.fundCurrency?.exchangeRate,
          destinationCurrencyCode: parsedFinancialFund?.code,
          type: "purchase",
          paymentType: "Withdrawal",
          description: req.body.paymentDescription,
          date: req.body.paymentDate || formattedDate,
          counter: Number(req.body.counter || 0) + nextCounterPayment.seq,
          companyId,
          payid: [
            {
              id: invoiceDoc._id,
              status: req.body.paid,
              invoiceTotal: req.body.invoiceGrandTotal,
              invoiceName: req.body.invoiceName,
              invoiceCurrencyCode: currency?.currencyCode,
              paymentInFundCurrency: paymentInFundCurrency,
              paymentMainCurrency: req.body.paymentInMainCurrency,
              paymentInInvoiceCurrency: req.body.paymentInInvoiceCurrency,
            },
          ],
        },
      ],
      { session },
    );

    await createPaymentHistoryV2({
      companyId,
      entryType: "payment",
      transactionDate: req.body.paymentDate || formattedDate,
      amountTransactionCurrency: paymentInFundCurrency,
      amountMainCurrency: req.body.paymentInMainCurrency,
      supplierId: supllierObject.id,
      referenceId: invoiceDoc._id,
      sourceModule: "expense",
      actionType: "create",
      paymentId: payment[0]._id,
      balanceEffectType: "Deposit",
      description: req.body.paymentDescription,
      transactionCurrency: parsedFinancialFund?.code,
      session,
    });

    const reports = await reportsFinancialFunds.create(
      [
        {
          date: req.body.paymentDate || formattedDate,
          ref: invoiceDoc._id,
          amount: paymentInFundCurrency,
          type: "purchase",
          exchangeRate,
          financialFundId: parsedFinancialFund?.id,
          financialFundRest: financialFund.fundBalance,
          paymentType: "Withdrawal",
          payment: payment[0]._id,
          description: req.body.paymentDescription,
          companyId,
        },
      ],
      { session },
    );

    invoiceDoc.payments.push({
      payment: paymentInFundCurrency,
      paymentMainCurrency: req.body.paymentInMainCurrency,
      financialFunds: financialFund.fundName,
      financialFundsCurrencyCode: parsedFinancialFund?.code,
      date: req.body.paymentDate || formattedDate,
      paymentID: payment[0]._id,
      paymentInInvoiceCurrency: req.body.paymentInInvoiceCurrency,
      financialFundsId: parsedFinancialFund?.id,
    });

    invoiceDoc.reportsBalanceId = reports[0]._id;

    await invoiceDoc.save({ session });
    await financialFund.save({ session });
  }

  return invoiceDoc;
};

exports.prepareExpenseInvoiceDataService = async ({
  req,
  companyId,
  session,
}) => {
  function padZero(value) {
    return value < 10 ? `0${value}` : value;
  }

  const ts = Date.now();

  const futureDateOb = new Date(ts);
  futureDateOb.setSeconds(futureDateOb.getSeconds() + 1);

  const futureFormattedDate = `${padZero(futureDateOb.getHours())}:${padZero(
    futureDateOb.getMinutes(),
  )}:${padZero(futureDateOb.getSeconds())}.${padZero(
    futureDateOb.getMilliseconds(),
    3,
  )}`;

  const date_ob = new Date(ts);

  const formattedDate = `${padZero(date_ob.getHours())}:${padZero(
    date_ob.getMinutes(),
  )}:${padZero(date_ob.getSeconds())}.${padZero(date_ob.getMilliseconds(), 3)}`;

  req.body.paymentDate = `${req.body.paymentDate}T${futureFormattedDate}Z`;

  const isopurchasDate = `${req.body.date}T${formattedDate}Z`;
  req.body.date = isopurchasDate;

  const supllierObject = req.body.supllier
    ? JSON.parse(req.body.supllier)
    : req.body.supllier;

  const taxDetails = req.body.taxDetails ? JSON.parse(req.body.taxDetails) : "";

  const currency = req.body.currency ? JSON.parse(req.body.currency) : "";

  const tag = req.body.tag ? JSON.parse(req.body.tag) : "";

  const supplier = await suppliersModel
    .findOne({
      _id: supllierObject.id,
      companyId,
    })
    .session(session);

  const draftJournalSnapshot = req.body.draftJournalSnapshot
    ? typeof req.body.draftJournalSnapshot === "string"
      ? JSON.parse(req.body.draftJournalSnapshot)
      : req.body.draftJournalSnapshot
    : null;

  return {
    supplier,
    supllierObject,
    taxDetails,
    currency,
    tag,
    formattedDate,
    draftJournalSnapshot,
  };
};

exports.reverseExpenseNoSupplierEffectsService = async ({
  expense,
  companyId,
  cancellationDate,
  session,
  req,
}) => {
  // ── 1. Find the payment that allocated to this expense ─────────────
  const findExpensePayment = await paymentModel
    .findOne({
      "allocations.documentId": expense._id,
      companyId,
      status: "active", // skip already-cancelled payments
    })
    .session(session);

  if (!findExpensePayment) {
    throw new Error("Payment not found for this expense");
  }

  // ── 2. Resolve the fund from the new payment shape ─────────────────
  const fundId = findExpensePayment.fund?.id;
  if (!fundId) {
    throw new Error("Fund id missing on payment");
  }

  const findFinancialFund = await financialFundsModel
    .findOne({ _id: fundId, companyId })
    .populate("fundCurrency")
    .session(session);

  if (!findFinancialFund) {
    throw new Error("Financial fund not found");
  }

  // ── 3. Resolve the allocation for THIS expense specifically ────────
  // A payment can have multiple allocations; reverse only the one
  // that targets this expense, not the whole payment.
  const allocation = findExpensePayment.allocations.find(
    (a) => String(a.documentId) === String(expense._id) && !a.cancelled,
  );

  if (!allocation) {
    throw new Error("Allocation not found for this expense");
  }

  // Amount that left the fund (in fund currency).
  // For outgoing payments, this is what we restore.
  // We use the document slice's converted-back-to-fund value:
  //   allocatedAmountMainCurrency * fund.exchangeRate
  // For a primary fund (rate 1) this equals the USD allocation.
  // For a non-primary fund it converts the primary slice back to fund.
  const fundExchangeRate = Number(
    findFinancialFund.fundCurrency?.exchangeRate || 1,
  );
  const amountInFundCurrency =
    Number(allocation.allocatedAmountMainCurrency) * fundExchangeRate;

  // ── 4. Reverse the fund balance ────────────────────────────────────
  // outgoing payment took money OUT, so cancellation puts it BACK.
  // incoming payment brought money IN, so cancellation takes it OUT.
  const isOutgoing = findExpensePayment.paymentNature === "outgoing";
  findFinancialFund.fundBalance += isOutgoing
    ? amountInFundCurrency
    : -amountInFundCurrency;

  await findFinancialFund.save({ session });

  // ── 5. Record the fund movement in reports ─────────────────────────
  await reportsFinancialFunds.create(
    [
      {
        date: cancellationDate,
        amount: amountInFundCurrency,
        direction: isOutgoing ? "in" : "out",
        source: "cancel_expense",
        refType: "expense",
        refId: expense._id,
        payment: findExpensePayment._id,
        financialFundId: findFinancialFund._id,
        financialFundRest: findFinancialFund.fundBalance,
        description: `Cancellation of payment ${findExpensePayment.counter} for expense ${expense.expenseName}`,
        createdBy: req.user?._id || null,
        companyId,
      },
    ],
    { session },
  );

  // ── 6. Mark the allocation as cancelled (don't delete) ─────────────
  // Keeps audit trail. If this was the only active allocation,
  // mark the whole payment cancelled too.
  allocation.cancelled = true;
  allocation.cancelledAt = cancellationDate;

  const hasActiveAllocations = findExpensePayment.allocations.some(
    (a) => !a.cancelled,
  );

  if (!hasActiveAllocations) {
    findExpensePayment.status = "cancelled";
    findExpensePayment.cancelledBy = req.user._id;
    findExpensePayment.cancelledAt = cancellationDate;
    findExpensePayment.cancellationReason = `All allocations cancelled (last: expense ${expense.expenseName})`;
  }

  await findExpensePayment.save({ session });

  // ── 7. Update the expense ──────────────────────────────────────────
  expense.payments = (expense.payments || []).filter(
    (p) => String(p.paymentID) !== String(findExpensePayment._id),
  );
  expense.paymentStatus = "unpaid";
  expense.status = "cancelled";
  expense.type = "Expense cancelled";
  expense.cancelledAt = cancellationDate;
  expense.cancelledBy = req.user._id;
  expense.cancellationReason = req.body.reason || "";

  // Restore the remainder so reporting shows the expense as fully open
  // again. This matches how a fresh unpaid expense looks.
  expense.totalRemainderMainCurrency = Number(expense.totalInMainCurrency || 0);
  expense.totalRemainder = Number(expense.invoiceGrandTotal || 0);

  await expense.save({ session });

  return { expense, payment: findExpensePayment };
};

exports.getExpenseAndPurchaseForSupplierService = async ({
  companyId,
  supplierId,
  req,
}) => {
  const pageSize = parseInt(req.query.limit) || 10;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * pageSize;
  const expenseFilter = {
    "supllier.id": supplierId,
    paymentStatus: "unpaid",
    status: "posted",
    companyId,
  };

  const purchaseFilter = {
    "supllier.id": supplierId,
    paid: "unpaid",
    status: "posted",

    companyId,
  };

  // Fetch both expenses and purchases
  const [expenses, purchases] = await Promise.all([
    expensesModel.find(expenseFilter),
    purchaseinvoicesModel.find(purchaseFilter),
  ]);

  // Add a type flag to distinguish in frontend
  const formattedExpenses = expenses.map((item) => ({
    ...item.toObject(),
    sourceType: "expense",
  }));

  const formattedPurchases = purchases.map((item) => ({
    ...item.toObject(),
    sourceType: "purchase",
  }));

  // Merge both arrays and sort by date if needed
  const combinedData = [...formattedExpenses, ...formattedPurchases].sort(
    (a, b) => new Date(b.date) - new Date(a.date),
  );

  // Paginate the combined result
  const paginatedData = combinedData.slice(skip, skip + pageSize);
  const totalItems = combinedData.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  return {
    results: paginatedData.length,
    totalItems,
    totalPages,
    data: paginatedData,
  };
};

// exports.paymentService = async ({
//   req,
//   companyId,
//   session,
//   newExpenseInvoice,
//   supplier,
// }) => {
//   const {
//     party,
//     paymentNature,
//     paymentDate,
//     description,
//     journalCounter,
//     counter,
//     postedBy,
//     postedAt,
//     paymentInFundCurrency,
//   } = req.body;

//   const fund = req.body.fund ? JSON.parse(req.body.fund) : null;
//   const payment = req.body.payment ? JSON.parse(req.body.payment) : null;

//   if (!fund?.id) {
//     throw new Error("Fund id is required");
//   }

//   if (!supplier?._id) {
//     throw new Error("Party is required");
//   }
//   const financialFund = await financialFundsModel.findOneAndUpdate(
//     { _id: fund.id || fund._id, companyId },
//     { $inc: { fundBalance: -paymentInFundCurrency } },
//     { new: true, session },
//   );

//   if (!financialFund) {
//     throw new Error("Financial fund not found");
//   }
//   let paymentAmountMain = Number(payment.amountMainCurrency || 0);
//   let paymentAmountInvoice = Number(payment.amount || 0);

//   const paymentSeq = await getNextCounterValue({
//     companyId,
//     name: "Payment",
//     session,
//   });
//   const paymentPayload = {
//     companyId,
//     counter: Number(counter || 0) + Number(paymentSeq),
//     party: {
//       id: supplier._id,
//       name: supplier.name,
//       type: "supplier",
//     },
//     fund: {
//       id: fund.id,
//       name: fund.name,
//       currencyId: fund.currencyId || "",
//       currencyCode: fund.currencyCode || "",
//       exchangeRate: Number(fund.exchangeRate || 1),
//     },
//     totalMainCurrency: paymentAmountMain,
//     paymentNature: "outgoing",
//     payment: {
//       amount: Number(payment?.amount || 0),
//       currencyId: payment?.currencyId || "",
//       currencyCode: payment?.currencyCode || "",
//       exchangeRate: Number(payment?.exchangeRate || 1),
//       amountMainCurrency: Number(payment?.amountMainCurrency || 0),
//     },
//     date: paymentDate,
//     description,
//     journalCounter,
//     file: req.body.file || "",
//     allocations: [
//       {
//         documentId: newExpenseInvoice._id,
//         documentName: newExpenseInvoice.invoiceName,
//         documentCounter: newExpenseInvoice.counter,
//         documentCurrencyCode: newExpenseInvoice.currency?.currencyCode || "",
//         allocatedAmountMainCurrency: paymentAmountMain,
//         allocatedAmountDocumentCurrency: paymentAmountInvoice,
//         documentTotal: newExpenseInvoice.invoiceGrandTotal,
//         documentType: "purchase_invoice",
//       },
//     ],
//     postedBy: postedBy || null,
//     postedAt: postedAt || new Date(),
//   };

//   const paymentDocs = await paymentsModel.create([paymentPayload], {
//     session,
//   });
//   const newPayment = paymentDocs[0];
//   createdPayment = newPayment;

//   if (newExpenseInvoice.totalRemainderMainCurrency <= 0.9) {
//     newExpenseInvoice.paymentsStatus = "paid";
//     newExpenseInvoice.totalRemainderMainCurrency = 0;
//     newExpenseInvoice.totalRemainder = 0;
//   }

//   newExpenseInvoice.payments.push({
//     payment: Number(payment.amount || paymentAmountInvoice),
//     paymentMainCurrency: payment.amountMainCurrency || paymentAmountMain,
//     financialFunds: fund.name,
//     paymentID: newPayment._id,
//     financialFundsCurrencyCode: fund.currencyCode,
//     exchangeRate: fund.exchangeRate,
//     date: paymentDate,
//     paymentInInvoiceCurrency:
//       payment.amountMainCurrency * newExpenseInvoice.currency.exchangeRate ||
//       paymentAmountInvoice,
//     financialFundsId: fund._id,
//   });

//   await newExpenseInvoice.save({ session });

//   await createInvoiceHistory(
//     companyId,
//     newExpenseInvoice._id,
//     "payment",
//     req.user._id,
//     paymentDate,
//     `${payment.amount} ${fund.currencyCode}`,
//     "invoice",
//     session,
//   );

//   supplier.TotalUnpaid = Number(supplier.TotalUnpaid || 0) - paymentAmountMain;
//   if (supplier.TotalUnpaid < 0) supplier.TotalUnpaid = 0;
//   await supplier.save({ session });

//   await createPaymentHistoryV2({
//     companyId,
//     entryType: "payment",
//     transactionDate: paymentDate,
//     amountTransactionCurrency: paymentInFundCurrency,
//     amountMainCurrency: payment.amountMainCurrency,
//     supplierId: supplier._id,
//     referenceId: newExpenseInvoice._id,
//     sourceModule: "payment",
//     actionType: "create",
//     paymentId: newPayment._id,
//     balanceEffectType: "Deposit",
//     description,
//     transactionCurrency: fund.currencyCode,
//     session,
//   });

//   await reportsFinancialFunds.create(
//     [
//       {
//         date: paymentDate,
//         amount: Number(paymentInFundCurrency || 0),
//         ref: newExpenseInvoice._id,
//         type: "Withdrawal",
//         financialFundId: financialFund._id,
//         financialFundRest: financialFund.fundBalance,
//         exchangeRate: newExpenseInvoice.currency?.exchangeRate || 1,
//         paymentType: "Withdrawal",
//         payment: newPayment._id,
//         description,
//         companyId,
//       },
//     ],
//     { session },
//   );
//   return true;
// };
