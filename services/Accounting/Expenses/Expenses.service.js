const expensesModel = require("../../../models/expensesModel");
const financialFundsModel = require("../../../models/financialFundsModel");
const invoiceHistoryModel = require("../../../models/invoiceHistoryModel");
const journalEntryModel = require("../../../models/journalEntryModel");
const paymentModel = require("../../../models/paymentModel");
const purchaseinvoicesModel = require("../../../models/purchaseinvoicesModel");
const reportsFinancialFunds = require("../../../models/reportsFinancialFunds");
const suppliersModel = require("../../../models/suppliersModel");
const ApiError = require("../../../utils/apiError");
const { createInvoiceHistory } = require("../../invoiceHistoryService");
const { createJournalService } = require("../../journalEntryServices");
const { createPaymentHistoryV2 } = require("../../paymentHistoryService");
const multer = require("multer");

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

exports.prepareExpensesDataService = async ({ req, companyId, session }) => {
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

  const supllierObject = req.body.supplier
    ? JSON.parse(req.body.supplier)
    : null;

  const taxDetails = req.body.taxDetails ? JSON.parse(req.body.taxDetails) : "";

  const categorts = req.body.categorts ? JSON.parse(req.body.categorts) : "";

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
    paymentDate,
    paymentInFundCurrency,
  } = req.body;

  let financialFund = null;
  let parsedFinancialFund = null;

  if (req.body.financialFund) {
    parsedFinancialFund =
      typeof req.body.financialFund === "string"
        ? JSON.parse(req.body.financialFund)
        : req.body.financialFund;
  }

  const paidAmountMain = Number(req.body.paymentInMainCurrency || 0);
  const paidAmountInvoice = Number(req.body.paymentInInvoiceCurrency || 0);
  const invoiceTotalMain = Number(expenceTotalMainCurrency || 0);
  const invoiceTotalInvoice = Number(expenceTotal || 0);

  const actualPaidMain = Math.min(paidAmountMain, invoiceTotalMain);
  const actualPaidInvoice = Math.min(paidAmountInvoice, invoiceTotalInvoice);

  const isFullyPaid = actualPaidMain >= invoiceTotalMain - 0.000001;
  const resolvedPaidStatus = isFullyPaid ? "paid" : "unpaid";
  const resolvedRemainderMain = Math.max(0, invoiceTotalMain - actualPaidMain);
  const resolvedRemainder = Math.max(
    0,
    invoiceTotalInvoice - actualPaidInvoice,
  );

  /*
      =============================
      HANDLE PAYMENT FUND
      =============================
    */
  if (actualPaidMain > 0 && !invoiceDraft) {
    financialFund = await financialFundsModel
      .findOne({ _id: parsedFinancialFund?.id, companyId })
      .populate("fundCurrency")
      .session(session);

    if (!financialFund) {
      throw new ApiError("Financial fund not found", 404);
    }

    financialFund.fundBalance -= Number(paymentInFundCurrency || 0);
  }

  /*
      =============================
      BUILD INVOICE PAYLOAD
      =============================
    */

  const invoicePayload = {
    employee: req.user._id,
    supllier: supllierObject,
    currency,
    paymentStatus: invoiceDraft ? "unpaid" : resolvedPaidStatus,
    expenceTotal,
    taxDetails,
    expenseName,
    tag,
    companyId,
    date: date || formattedDate,
    journalCounter,

    file: req.body.file,
    paymentDate,
    totalRemainder: invoiceDraft ? totalRemainder : resolvedRemainder,
    totalRemainderMainCurrency: invoiceDraft
      ? totalRemainderMainCurrency
      : resolvedRemainderMain,
    type: "expense",
    status: invoiceDraft ? "draft" : "posted",
    isDraft: invoiceDraft,
    postedAt: invoiceDraft ? null : new Date(),
    expenseName,
    date,
    expenceTotal,
    expenceTaxTotal,
    expenceTotalMainCurrency,
    receiptNumber,
    mainCurrencyTax,
    paymentStatus,
    expenseClarification,
    draftJournalSnapshot,
    categorts,
    employeeID: invoiceDraft ? null : req.user._id,
    employeeName: invoiceDraft ? null : req.user.name,
    isCash: req.body.isCash || false,
  };

  if (!invoiceDraft) {
    invoicePayload.counter =
      Number(req.body.counter || 0) + nextCounterExpensesInvoices.seq;
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

  if (actualPaidMain > 0 && !invoiceDraft) {
    invoicePayload.financailFund = parsedFinancialFund;
    invoicePayload.paymentInFundCurrency = paymentInFundCurrency;
  }

  if (!invoiceDraft && resolvedPaidStatus === "unpaid") {
    invoicePayload.dueDate = paymentDate;
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
      PAYMENT CREATION
      =============================
    */
  if (actualPaidMain > 0 && !invoiceDraft) {
    const payment = await paymentModel.create(
      [
        {
          source: {
            id: financialFund._id,
            name: financialFund.fundName,
          },
          destination: {
            id: supllierObject?.id || "",
            name: supllierObject?.name || "",
          },
          sourceType: "fund",
          destinationType: "supplier",
          totalInPaymentCurrency: actualPaidInvoice,
          totalMainCurrency: actualPaidMain,
          paymentInDestinationCurrency: paymentInFundCurrency,
          paymentCurrency: {
            id: currency?.id,
            name: currency?.name,
            code: currency?.currencyCode,
            exchangeRate: currency?.exchangeRate,
          },
          destinationExchangeRate: financialFund?.fundCurrency?.exchangeRate,
          destinationCurrencyCode: parsedFinancialFund?.code,
          type: "expense",
          paymentType: "Withdrawal",
          description: req.body.paymentDescription,
          date: req.body.paymentDate || formattedDate,
          counter: Number(req.body.counter || 0) + nextCounterPayment.seq,
          companyId,
          payid: [
            {
              id: newExpenseInvoice._id,
              status: resolvedPaidStatus,
              invoiceTotal: req.body.expenceTotal,
              invoiceName: req.body.expenseName,
              invoiceCurrencyCode: currency?.currencyCode,
              paymentInFundCurrency: paymentInFundCurrency,
              paymentMainCurrency: actualPaidMain,
              paymentInInvoiceCurrency: actualPaidInvoice,
            },
          ],
        },
      ],
      { session },
    );

    await createPaymentHistoryV2({
      companyId,
      entryType: "payment",
      transactionDate: req.body.date || formattedDate,
      amountTransactionCurrency: invoiceTotalInvoice,
      amountMainCurrency: invoiceTotalMain,
      supplierId: supplier?._id || "",
      referenceId: newExpenseInvoice._id,
      sourceModule: "payment",
      actionType: "create",
      description: req.body.description,
      transactionCurrency: currency?.currencyCode,
      session,
      balanceEffectType: "Deposit",
    });

    const reports = await reportsFinancialFunds.create(
      [
        {
          date: req.body.paymentDate || formattedDate,
          ref: newExpenseInvoice._id,
          amount: paymentInFundCurrency,
          type: "expense",
          exchangeRate: financialFund?.fundCurrency?.exchangeRate,
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

    newExpenseInvoice.payments.push({
      payment: paymentInFundCurrency,
      paymentMainCurrency: actualPaidMain,
      financialFunds: financialFund.fundName,
      financialFundsCurrencyCode: parsedFinancialFund?.code,
      date: req.body.paymentDate || formattedDate,
      paymentID: payment[0]._id,
      paymentInInvoiceCurrency: actualPaidInvoice,
      financialFundsId: parsedFinancialFund?.id,
    });

    newExpenseInvoice.reportsBalanceId = reports[0]._id;

    await newExpenseInvoice.save({ session });
    await financialFund.save({ session });
  }

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

  if (actualPaidMain > 0 && !invoiceDraft) {
    await createInvoiceHistory(
      companyId,
      newExpenseInvoice._id,
      "payment",
      req.user._id,
      req.body.paymentDate || formattedDate,
      "Invoice payment recorded",
      "expense",
      session,
    );
  }

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

  if (paymentStatus === "unpaid") {
    supplier.TotalUnpaid += totalMain;
  }

  if (paymentStatus === "paid") {
    supplier.TotalUnpaid += remainderMain;
  }

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
  const remainderMain = Number(expense.totalRemainderMainCurrency || 0);

  supplier.total = Number(supplier.total || 0) - totalMain;

  if (expense.paymentStatus === "unpaid") {
    supplier.TotalUnpaid = Number(supplier.TotalUnpaid || 0) - totalMain;
  }

  if (expense.paymentStatus === "paid") {
    supplier.TotalUnpaid = Number(supplier.TotalUnpaid || 0) - remainderMain;
  }

  if (supplier.total < 0) supplier.total = 0;
  if (supplier.TotalUnpaid < 0) supplier.TotalUnpaid = 0;

  await supplier.save({ session });

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
  reversalJournalLinkCounter,
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

  const reversedLines = originalLines.map((line, index) => ({
    ...line,
    MainDebit: Number(line?.MainCredit || 0),
    MainCredit: Number(line?.MainDebit || 0),
    accountDebit: Number(line?.accountCredit || 0),
    accountCredit: Number(line?.accountDebit || 0),
    counter: index + 1,
  }));

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
    linkCounter: String(reversalJournalLinkCounter),
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

  const createdReversalJournal = await createJournalService({
    companyId,
    journalInfo: reversalJournalPayload,
    journalAccounts: reversedLines,
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
}) => {
  const findExpensePayment = await paymentModel
    .findOne({
      "payid.id": expense._id,
      companyId,
    })
    .session(session);

  if (!findExpensePayment) {
    throw new Error("Payment not found");
  }

  const fundId =
    findExpensePayment.source?.id || findExpensePayment.destination?.id;

  const findFinancialFund = await financialFundsModel
    .findOne({
      _id: fundId,
      companyId,
    })
    .populate("fundCurrency")
    .session(session);

  if (!findFinancialFund) {
    throw new Error("Financial fund not found");
  }

  const amount = Number(findExpensePayment.paymentInDestinationCurrency);

  // 🔁 reverse logic
  findFinancialFund.fundBalance += amount;

  await findFinancialFund.save({ session });

  await reportsFinancialFunds.create(
    [
      {
        date: cancellationDate,
        amount: expense.paymentInFundCurrency,
        ref: expense._id,
        type: "cancel expense",
        financialFundId: findFinancialFund._id,
        financialFundRest: findFinancialFund.fundBalance,
        exchangeRate: expense.currencyExchangeRate,
        paymentType: "Deposit",
        payment: findExpensePayment._id,
        description: expense.paymentDisc,
        companyId,
      },
    ],
    { session },
  );

  expense.payments = expense.payments.filter(
    (p) => String(p.paymentId) !== String(findExpensePayment._id),
  );

  expense.type = "expenses cancelled";
  expense.paymentStatus = "unpaid";

  await expense.save({ session });

  findExpensePayment.description = `Cancelled payment for expense ${expense.expenseName}`;

  findExpensePayment.payid = findExpensePayment.payid.filter(
    (p) => String(p.id) !== String(expense._id),
  );

  findExpensePayment.type = "cancelled payment";

  await findExpensePayment.save({ session });

  return {
    expense,
  };
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
    companyId,
  };

  const purchaseFilter = {
    "supllier.id": supplierId,
    paid: "unpaid",
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
