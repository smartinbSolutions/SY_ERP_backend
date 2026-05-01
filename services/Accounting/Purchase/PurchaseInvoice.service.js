// ===== Core Packages =====
const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const multer = require("multer");

// ===== Utilities =====
const ApiError = require("../../../utils/apiError");
const { createProductMovement } = require("../../../utils/productMovement");

// ===== Services =====
const { createInvoiceHistory } = require("../../invoiceHistoryService");
const {
  createPaymentHistory,
  createPaymentHistoryV2,
} = require("../../paymentHistoryService");
const { createProductBatch } = require("../../productBatchServices");

// ===== Models =====
const PurchaseInvoicesModel = require("../../../models/purchaseinvoicesModel");
const suppliersModel = require("../../../models/suppliersModel");
const financialFundsModel = require("../../../models/Accounting/CurrentAssets/financialFundsModel");
const productModel = require("../../../models/productModel");
const PaymentModel = require("../../../models/paymentModel");
const reportsFinancialFunds = require("../../../models/Accounting/CurrentAssets/reportsFinancialFunds");
const refundPurchaseInviceModel = require("../../../models/refundPurchaseInviceModel");
const paymentHistoryModel = require("../../../models/paymentHistoryModel");
const invoiceHistoryModel = require("../../../models/invoiceHistoryModel");
const unTracedproductLogModel = require("../../../models/unTracedproductLogModel");
const ShortageModel = require("../../../models/ShortageModel");
const prodcutBatchModel = require("../../../models/Stocks/products/prodcutBatchModel");
const { createJournalService } = require("../../journalEntryServices");
const batchLedgerModel = require("../../../models/Stocks/products/batchLedgerModel");
const journalEntryModel = require("../../../models/journalEntryModel");
const { getNextCounterValue } = require("../../../utils/getNextCounterValue");
const paymentsModel = require("../../../models/Accounting/CurrentAssets/payments.model");

//Fixed Ourchse invoice
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
        new ApiError("Invalid file type. Only images and PDFs are allowed.")
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

exports.uploadFile = upload.single("file");

// Get All Purchase Invoices
exports.findAllPurchaseInvoicesService = async ({ req, companyId }) => {
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

  const totalItems = await PurchaseInvoicesModel.countDocuments(query);

  const totalPages = Math.ceil(totalItems / pageSize);
  const purchaseInvoices = await PurchaseInvoicesModel.find(query)
    .sort({ date: -1 })
    .skip(skip)
    .limit(pageSize)
    .populate({
      path: "employee",
      select: "name profileImg email phone",
    });

  return {
    totalItems,
    totalPages,
    purchaseInvoices,
  };
};

exports.findOnePurchaseInvoiceService = async ({ req, companyId }) => {
  const { id } = req.params;

  const purchaseInvoice = await PurchaseInvoicesModel.findOne({
    _id: id,
    companyId,
  })
    .populate({
      path: "employee",
      select: "name profileImg email phone",
    })
    .populate("invoicesItems.tax");

  if (!purchaseInvoice) {
    throw new ApiError(`No purchase invoice for this id ${id}`, 404);
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
    purchaseInvoice,
    invoiceHistory,
  };
};

exports.findSupplierPurchaseInvoicesForRefundService = async ({
  req,
  companyId,
}) => {
  const { supplierId } = req.params;

  if (!supplierId) {
    throw new ApiError("supplierId is required", 400);
  }

  const pageSize = Number(req.query.limit) || 20;
  const page = Number(req.query.page) || 1;
  const skip = (page - 1) * pageSize;

  const query = {
    companyId,
    "supllier.id": supplierId,
    status: "posted",
  };

  const totalItems = await PurchaseInvoicesModel.countDocuments(query);
  const totalPages = Math.ceil(totalItems / pageSize);

  const purchaseInvoices = await PurchaseInvoicesModel.find(query)
    .sort({ date: -1, createdAt: -1 })
    .skip(skip)
    .limit(pageSize)
    .populate({
      path: "employee",
      select: "name profileImg email phone",
    });

  return {
    totalItems,
    totalPages,
    purchaseInvoices,
  };
};
//
exports.preparePurchaseInvoiceDataService = async ({
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
    futureDateOb.getMinutes()
  )}:${padZero(futureDateOb.getSeconds())}.${padZero(
    futureDateOb.getMilliseconds(),
    3
  )}`;

  const date_ob = new Date(ts);

  const formattedDate = `${padZero(date_ob.getHours())}:${padZero(
    date_ob.getMinutes()
  )}:${padZero(date_ob.getSeconds())}.${padZero(date_ob.getMilliseconds(), 3)}`;

  req.body.paymentDate = `${req.body.paymentDate}T${futureFormattedDate}Z`;

  const isopurchasDate = `${req.body.date}T${formattedDate}Z`;
  req.body.date = isopurchasDate;

  const supllierObject = req.body.supllierObject
    ? JSON.parse(req.body.supllierObject)
    : req.body.supllierObject;

  const taxDetails = req.body.taxDetails ? JSON.parse(req.body.taxDetails) : "";

  const invoicesItem = req.body.invoicesItems
    ? JSON.parse(req.body.invoicesItems)
    : "";

  const currency = req.body.currency ? JSON.parse(req.body.currency) : "";

  const tag = req.body.tag ? JSON.parse(req.body.tag) : "";

  const supplier = await suppliersModel
    .findOne({
      _id: supllierObject.id,
      companyId,
    })
    .session(session);

  const productIds = invoicesItem.map((item) => item.id);

  const products = await productModel
    .find({
      _id: productIds,
      companyId,
    })
    .session(session);

  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  const draftJournalSnapshot = req.body.draftJournalSnapshot
    ? typeof req.body.draftJournalSnapshot === "string"
      ? JSON.parse(req.body.draftJournalSnapshot)
      : req.body.draftJournalSnapshot
    : null;

  return {
    supplier,
    invoicesItem,
    supllierObject,
    taxDetails,
    currency,
    tag,
    formattedDate,
    productMap,
    draftJournalSnapshot,
  };
};

exports.preparePurchaseInvoiceDataFromDraftService = async ({
  purchaseInvoice,
  companyId,
  session,
}) => {
  const supllierObject = purchaseInvoice.supllier || {};
  const taxDetails = purchaseInvoice.taxDetails || [];
  const invoicesItem = purchaseInvoice.invoicesItems || [];
  const currency = purchaseInvoice.currency || {};
  const tag = purchaseInvoice.tag || [];

  const supplier = await suppliersModel
    .findOne({
      _id: supllierObject.id,
      companyId,
    })
    .session(session);

  const productIds = invoicesItem
    .filter((item) => item.type === "product" || item.type === "variants")
    .map((item) => item.id)
    .filter(Boolean);

  const products = await productModel
    .find({
      _id: { $in: productIds },
      companyId,
    })
    .session(session);

  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  return {
    supplier,
    invoicesItem,
    supllierObject,
    taxDetails,
    currency,
    tag,
    productMap,
  };
};

exports.createPurchaseInvoiceRecordService = async ({
  req,
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
    paid,
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

  const addSeconds = (dateValue, seconds = 0) => {
    const date = new Date(dateValue || new Date());
    date.setSeconds(date.getSeconds() + seconds);
    return date;
  };

  const paymentTransactionDate = addSeconds(
    req.body.paymentDate || req.body.date || formattedDate,
    5
  );
  let financialFund = null;
  let parsedFinancialFund = null;

  // if (req.body.financailFund) {
  //   parsedFinancialFund =
  //     typeof req.body.financailFund === "string"
  //       ? JSON.parse(req.body.financailFund)
  //       : req.body.financailFund;
  // }

  /*
      =============================
      RESOLVE PAYMENT / REMAINDER
      =============================
    */
  const paidAmountMain = Number(req.body.paymentInMainCurrency || 0);
  const paidAmountInvoice = Number(req.body.paymentInInvoiceCurrency || 0);
  const invoiceTotalMain = Number(totalInMainCurrency || 0);
  const invoiceTotalInvoice = Number(invoiceGrandTotal || 0);

  const actualPaidMain = Math.min(paidAmountMain, invoiceTotalMain);
  const actualPaidInvoice = Math.min(paidAmountInvoice, invoiceTotalInvoice);

  const isFullyPaid = actualPaidMain >= invoiceTotalMain - 0.000001;
  const resolvedPaidStatus = isFullyPaid ? "paid" : "unpaid";
  const resolvedRemainderMain = Math.max(0, invoiceTotalMain - actualPaidMain);
  const resolvedRemainder = Math.max(
    0,
    invoiceTotalInvoice - actualPaidInvoice
  );

  /*
      =============================
      HANDLE PAYMENT FUND
      =============================
    */
  // if (actualPaidMain > 0 && !invoiceDraft) {
  //   financialFund = await financialFundsModel
  //     .findOne({ _id: parsedFinancialFund?.id, companyId })
  //     .session(session);

  //   if (!financialFund) {
  //     throw new ApiError("Financial fund not found", 404);
  //   }

  //   financialFund.fundBalance -= Number(paymentInFundCurrency || 0);
  // }

  /*
      =============================
      BUILD INVOICE PAYLOAD
      =============================
    */
  const invoicePayload = {
    employee: req.user._id,
    invoicesItems: invoicesItem,
    supllier: supllierObject,
    currency,
    exchangeRate,
    invoiceNumber,
    paid: invoiceDraft ? "unpaid" : resolvedPaidStatus,
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
    totalRemainder: invoiceDraft ? totalRemainder : resolvedRemainder,
    totalRemainderMainCurrency: invoiceDraft
      ? totalRemainderMainCurrency
      : resolvedRemainderMain,
    type: "purchase",
    status: invoiceDraft ? "draft" : "posted",
    isDraft: invoiceDraft,
    postedBy: invoiceDraft ? null : req.user._id,
    postedAt: invoiceDraft ? null : new Date(),
  };

  if (!invoiceDraft) {
    invoicePayload.counter =
      Number(req.body.counter || 0) + nextCounterPurchaseInvoices.seq;
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

  // if (actualPaidMain > 0 && !invoiceDraft) {
  //   invoicePayload.financailFund = parsedFinancialFund;
  //   invoicePayload.paymentInFundCurrency = paymentInFundCurrency;
  // }

  if (!invoiceDraft && resolvedPaidStatus === "unpaid") {
    invoicePayload.dueDate = paymentDate;
  }

  /*
      =============================
      CREATE INVOICE
      =============================
    */
  const createdInvoice = await PurchaseInvoicesModel.create([invoicePayload], {
    session,
  });

  const newPurchaseInvoice = createdInvoice[0];

  /*
      =============================
      PAYMENT CREATION
      =============================
    */
  // if (actualPaidMain > 0 && !invoiceDraft) {
  //   const payment = await PaymentModel.create(
  //     [
  //       {
  //         source: {
  //           id: financialFund._id,
  //           name: financialFund.fundName,
  //         },
  //         destination: {
  //           id: supllierObject.id,
  //           name: supllierObject.name,
  //         },
  //         sourceType: "fund",
  //         destinationType: "supplier",
  //         totalInPaymentCurrency: actualPaidInvoice,
  //         totalMainCurrency: actualPaidMain,
  //         paymentInDestinationCurrency: paymentInFundCurrency,
  //         paymentCurrency: {
  //           id: currency?.id,
  //           name: currency?.name,
  //           code: currency?.currencyCode,
  //           exchangeRate: currency?.exchangeRate,
  //         },
  //         destinationExchangeRate: financialFund?.fundCurrency?.exchangeRate,
  //         destinationCurrencyCode: parsedFinancialFund?.code,
  //         type: "purchase",
  //         paymentType: "Withdrawal",
  //         description: req.body.paymentDescription,
  //         date: req.body.paymentDate || formattedDate,
  //         counter: Number(req.body.counter || 0) + nextCounterPayment.seq,
  //         companyId,
  //         payid: [
  //           {
  //             id: newPurchaseInvoice._id,
  //             status: resolvedPaidStatus,
  //             invoiceTotal: req.body.invoiceGrandTotal,
  //             invoiceName: req.body.invoiceName,
  //             invoiceCurrencyCode: currency?.currencyCode,
  //             paymentInFundCurrency: paymentInFundCurrency,
  //             paymentMainCurrency: actualPaidMain,
  //             paymentInInvoiceCurrency: actualPaidInvoice,
  //           },
  //         ],
  //       },
  //     ],
  //     { session },
  //   );
  //   const createdPayment = payment[0];
  //   await createPaymentHistoryV2({
  //     companyId,
  //     entryType: "payment",
  //     transactionDate: paymentTransactionDate,
  //     amountTransactionCurrency: actualPaidInvoice,
  //     amountMainCurrency: actualPaidMain,
  //     supplierId: supplier._id,
  //     paymentId: createdPayment._id,
  //     referenceId: newPurchaseInvoice._id,
  //     sourceModule: "purchase",
  //     actionType: "create",
  //     description: req.body.description,
  //     transactionCurrency: currency?.currencyCode,
  //     balanceEffectType: "Deposit",
  //     session,
  //   });

  //   const reports = await reportsFinancialFunds.create(
  //     [
  //       {
  //         date: req.body.paymentDate || formattedDate,
  //         ref: newPurchaseInvoice._id,
  //         amount: paymentInFundCurrency,
  //         type: "purchase",
  //         exchangeRate,
  //         financialFundId: parsedFinancialFund?.id,
  //         financialFundRest: financialFund.fundBalance,
  //         paymentType: "Withdrawal",
  //         payment: payment[0]._id,
  //         description: req.body.paymentDescription,
  //         companyId,
  //       },
  //     ],
  //     { session },
  //   );

  //   newPurchaseInvoice.payments.push({
  //     payment: paymentInFundCurrency,
  //     paymentMainCurrency: actualPaidMain,
  //     financialFunds: financialFund.fundName,
  //     financialFundsCurrencyCode: parsedFinancialFund?.code,
  //     date: req.body.paymentDate || formattedDate,
  //     paymentID: payment[0]._id,
  //     paymentInInvoiceCurrency: actualPaidInvoice,
  //     financialFundsId: parsedFinancialFund?.id,
  //   });

  //   newPurchaseInvoice.reportsBalanceId = reports[0]._id;

  //   await newPurchaseInvoice.save({ session });
  //   await financialFund.save({ session });
  // }

  /*
      =============================
      INVOICE HISTORY
      =============================
    */
  await createInvoiceHistory(
    companyId,
    newPurchaseInvoice._id,
    "create",
    req.user._id,
    req.body.date || formattedDate,
    invoiceDraft
      ? "Purchase invoice draft created"
      : "Purchase invoice created",
    "purchase",
    session
  );

  // if (actualPaidMain > 0 && !invoiceDraft) {
  //   await createInvoiceHistory(
  //     companyId,
  //     newPurchaseInvoice._id,
  //     "payment",
  //     req.user._id,
  //     req.body.paymentDate || formattedDate,
  //     "Invoice payment recorded",
  //     "purchase",
  //     session,
  //   );
  // }

  return newPurchaseInvoice;
};
// Purchase Inventory Effects

exports.upsertPurchaseInvoiceRecordService = async ({
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
    paid,
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

  // if (req.body.financailFund) {
  //   parsedFinancialFund =
  //     typeof req.body.financailFund === "string"
  //       ? JSON.parse(req.body.financailFund)
  //       : req.body.financailFund;
  // }

  // if (paid === "paid" && !invoiceDraft) {
  //   financialFund = await financialFundsModel
  //     .findOne({ _id: parsedFinancialFund?.id, companyId })
  //     .session(session);

  // if (!financialFund) {
  //   throw new ApiError("Financial fund not found", 404);
  // }

  // financialFund.fundBalance -= Number(paymentInFundCurrency || 0);
  //}

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

  // if (paid === "paid" && !invoiceDraft) {
  //   invoicePayload.financailFund = parsedFinancialFund;
  //   invoicePayload.paymentInFundCurrency = paymentInFundCurrency;
  // }

  if (paid === "unpaid") {
    invoicePayload.dueDate = paymentDate;
  }

  let invoiceDoc;

  if (mode === "create") {
    const createdInvoice = await PurchaseInvoicesModel.create(
      [invoicePayload],
      {
        session,
      }
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

  // if (paid === "paid" && !invoiceDraft) {
  //   const payment = await PaymentModel.create(
  //     [
  //       {
  //         source: {
  //           id: financialFund._id,
  //           name: financialFund.fundName,
  //         },
  //         destination: {
  //           id: supllierObject.id,
  //           name: supllierObject.name,
  //         },
  //         sourceType: "purchase", // keep old model for now
  //         destinationType: "fund",
  //         totalInPaymentCurrency: req.body.paymentInInvoiceCurrency,
  //         totalMainCurrency: req.body.paymentInMainCurrency,
  //         paymentInDestinationCurrency: req.body.paymentInFundCurrency,
  //         paymentCurrency: {
  //           id: currency?.id,
  //           name: currency?.name,
  //           code: currency?.currencyCode,
  //           exchangeRate: currency?.exchangeRate,
  //         },
  //         destinationExchangeRate: financialFund?.fundCurrency?.exchangeRate,
  //         destinationCurrencyCode: parsedFinancialFund?.code,
  //         type: "purchase",
  //         paymentType: "Withdrawal",
  //         description: req.body.paymentDescription,
  //         date: req.body.paymentDate || formattedDate,
  //         counter: Number(req.body.counter || 0) + nextCounterPayment.seq,
  //         companyId,
  //         payid: [
  //           {
  //             id: invoiceDoc._id,
  //             status: req.body.paid,
  //             invoiceTotal: req.body.invoiceGrandTotal,
  //             invoiceName: req.body.invoiceName,
  //             invoiceCurrencyCode: currency?.currencyCode,
  //             paymentInFundCurrency: paymentInFundCurrency,
  //             paymentMainCurrency: req.body.paymentInMainCurrency,
  //             paymentInInvoiceCurrency: req.body.paymentInInvoiceCurrency,
  //           },
  //         ],
  //       },
  //     ],
  //     { session },
  //   );

  //   await createPaymentHistoryV2({
  //     companyId,
  //     entryType: "payment",
  //     transactionDate: req.body.paymentDate || formattedDate,
  //     amountTransactionCurrency: paymentInFundCurrency,
  //     amountMainCurrency: req.body.paymentInMainCurrency,
  //     supplierId: supllierObject.id,
  //     referenceId: invoiceDoc._id,
  //     sourceModule: "purchase",
  //     actionType: "create",
  //     paymentId: payment[0]._id,
  //     balanceEffectType: "Deposit",
  //     description: req.body.paymentDescription,
  //     transactionCurrency: parsedFinancialFund?.code,
  //     session,
  //   });

  //   const reports = await reportsFinancialFunds.create(
  //     [
  //       {
  //         date: req.body.paymentDate || formattedDate,
  //         ref: invoiceDoc._id,
  //         amount: paymentInFundCurrency,
  //         type: "purchase",
  //         exchangeRate,
  //         financialFundId: parsedFinancialFund?.id,
  //         financialFundRest: financialFund.fundBalance,
  //         paymentType: "Withdrawal",
  //         payment: payment[0]._id,
  //         description: req.body.paymentDescription,
  //         companyId,
  //       },
  //     ],
  //     { session },
  //   );

  //   invoiceDoc.payments.push({
  //     payment: paymentInFundCurrency,
  //     paymentMainCurrency: req.body.paymentInMainCurrency,
  //     financialFunds: financialFund.fundName,
  //     financialFundsCurrencyCode: parsedFinancialFund?.code,
  //     date: req.body.paymentDate || formattedDate,
  //     paymentID: payment[0]._id,
  //     paymentInInvoiceCurrency: req.body.paymentInInvoiceCurrency,
  //     financialFundsId: parsedFinancialFund?.id,
  //   });

  //   invoiceDoc.reportsBalanceId = reports[0]._id;

  //   await invoiceDoc.save({ session });
  //   await financialFund.save({ session });
  // }

  return invoiceDoc;
};

exports.applyPurchaseInventoryEffectsService = async ({
  invoicesItem,
  productMap,
  newPurchaseInvoice,
  companyId,
  date,
  session,
}) => {
  const invoiceCurrency = newPurchaseInvoice?.currency;
  const exchangeRate = Number(newPurchaseInvoice?.exchangeRate || 1);

  const isTrackedInventoryItem = (item) =>
    item.type !== "unTracedproduct" && item.type !== "expense";

  const getTotalStockQuantity = (product) =>
    (product.stocks || []).reduce(
      (total, stock) => total + Number(stock.productQuantity || 0),
      0
    );

  const getOriginalBuyingPrice = (item) => {
    const itemCurrencyId =
      typeof item?.currency === "object" ? item?.currency?.id : item?.currency;

    const isSameCurrency =
      String(itemCurrencyId) === String(invoiceCurrency?.id);

    if (isSameCurrency) {
      return Number(item?.convertedBuyingPrice || 0);
    }

    return Number(item?.orginalBuyingPrice || 0);
  };

  const getNewAverageCost = ({ oldQty, oldCost, newQty, newCost }) =>
    oldQty + newQty > 0
      ? (oldQty * oldCost + newQty * newCost) / (oldQty + newQty)
      : newCost;

  const getMovementPricing = (item) => {
    const enteredBuyingPriceMainCurrency =
      exchangeRate > 0
        ? Number(item.convertedBuyingPrice || 0) / exchangeRate
        : 0;

    const movementExchangerate =
      enteredBuyingPriceMainCurrency > 0
        ? getOriginalBuyingPrice(item) / enteredBuyingPriceMainCurrency
        : 1;

    return {
      enteredBuyingPriceMainCurrency,
      movementExchangerate,
    };
  };

  const inventoryItems = invoicesItem.filter(isTrackedInventoryItem);

  const bulkProductUpdates = inventoryItems
    .map((item) => {
      const product = productMap.get(item.id);
      if (!product || !item.stock?._id) return null;

      const oldQty = getTotalStockQuantity(product);
      const oldCost = Number(product.costBuyingPrice || 0);
      const newQty = Number(item.quantity || 0);
      const newCost = getOriginalBuyingPrice(item);

      const newAvgCost = getNewAverageCost({
        oldQty,
        oldCost,
        newQty,
        newCost,
      });

      return {
        updateOne: {
          filter: {
            _id: item.id,
            companyId,
            "stocks.stockId": item.stock._id,
          },
          update: {
            $inc: {
              "stocks.$.productQuantity": newQty,
            },
            $set: {
              buyingprice: getOriginalBuyingPrice(item),
              costBuyingPrice: newAvgCost,
            },
          },
        },
      };
    })
    .filter(Boolean);

  const bulkProductInserts = inventoryItems
    .filter((item) => item.stock?._id)
    .map((item) => {
      const product = productMap.get(item.id);
      if (!product || !item.stock?._id) return null;

      const oldQty = getTotalStockQuantity(product);
      const oldCost = Number(product.costBuyingPrice || 0);
      const newQty = Number(item.quantity || 0);
      const newCost = getOriginalBuyingPrice(item);

      const newAvgCost = getNewAverageCost({
        oldQty,
        oldCost,
        newQty,
        newCost,
      });

      return {
        updateOne: {
          filter: {
            _id: item.id,
            companyId,
            "stocks.stockId": { $ne: item.stock._id },
          },
          update: {
            $set: {
              buyingprice: getOriginalBuyingPrice(item),
              costBuyingPrice: newAvgCost,
            },
            $push: {
              stocks: {
                stockId: item.stock._id,
                stockName: item.stock.stock,
                productQuantity: newQty,
              },
            },
          },
        },
      };
    })
    .filter(Boolean);

  const bulkOperations = [...bulkProductUpdates, ...bulkProductInserts];

  if (bulkOperations.length > 0) {
    await productModel.bulkWrite(bulkOperations, { session });
  }

  for (const item of inventoryItems) {
    const product = productMap.get(item.id);
    if (!product) continue;

    const totalStockQuantity = getTotalStockQuantity(product);

    const { enteredBuyingPriceMainCurrency, movementExchangerate } =
      getMovementPricing(item);

    await createProductMovement({
      productId: item.id,
      reference: newPurchaseInvoice._id,
      newQuantity: totalStockQuantity + Number(item.quantity || 0),
      quantity: item.quantity,
      movementType: "in",
      source: "Purchase Invoice",
      companyId,
      enterPrice: getOriginalBuyingPrice(item),
      enterPriceMainCurrency: enteredBuyingPriceMainCurrency,
      stockId: item.stock?._id,
      buyingPrice: getOriginalBuyingPrice(item),
      exchangeRate: movementExchangerate,
      movementDate: date,
      session,
    });

    await createProductBatch({
      productId: item.id,
      companyId,
      stockId: item.stock?._id,
      quantity: item.quantity,
      buyingprice: item.orginalBuyingPrice,
      sourceId: newPurchaseInvoice._id,
      sourceType: "purchase",
      originId: newPurchaseInvoice._id,
      originType: "purchase",
      batchDate: date,
      session,
    });
  }
};

exports.reversePurchaseInventoryEffectsService = async ({
  invoicesItem,
  productMap,
  purchaseInvoice,
  companyId,
  session,
  reversedBy = null,
  reverseReason,
  cancellationDate,
  mode = "cancel",
}) => {
  const invoiceExchangeRate = Number(purchaseInvoice?.exchangeRate || 1);

  const isTrackedInventoryItem = (item) =>
    item.type !== "unTracedproduct" && item.type !== "expense";

  const getOriginalBuyingPrice = (item) => Number(item.orginalBuyingPrice || 0);

  const getMainCurrencyPrice = (item) =>
    invoiceExchangeRate > 0
      ? Number(item.convertedBuyingPrice || 0) / invoiceExchangeRate
      : 0;

  const getMovementExchangeRate = (item) => {
    const mainCurrencyPrice = getMainCurrencyPrice(item);

    return mainCurrencyPrice > 0
      ? getOriginalBuyingPrice(item) / mainCurrencyPrice
      : 1;
  };

  const reversalConfig = {
    cancel: {
      reverseReason: reverseReason || "Purchase invoice cancellation",
      referenceType: "purchase_cancel",
      movementSource: "Purchase Invoice Cancellation",
      reverseSourceType: "purchase_cancel",
      batchStatus: "reversed",
    },
    reverse_update: {
      reverseReason: reverseReason || "Purchase invoice reverse update",
      referenceType: "purchase_reverse_update",
      movementSource: "Purchase Invoice Reverse Update",
      reverseSourceType: "purchase_reverse_update",
      batchStatus: "reversed_for_update",
    },
  };

  const currentMode = reversalConfig[mode];
  if (!currentMode) {
    throw new ApiError(`Invalid reversal mode: ${mode}`, 400);
  }

  const inventoryItems = invoicesItem.filter(isTrackedInventoryItem);
  const bulkProductUpdates = [];

  for (const item of inventoryItems) {
    const product = productMap.get(item.id);
    if (!product) {
      throw new ApiError(`Product not found for item ${item.name}`, 404);
    }

    if (!item.stock?._id) {
      throw new ApiError(`Stock is missing for item ${item.name}`, 400);
    }

    const stockRow = (product.stocks || []).find(
      (stock) => String(stock.stockId) === String(item.stock._id)
    );

    if (!stockRow) {
      throw new ApiError(
        `Stock row not found for product ${item.name} in selected stock`,
        400
      );
    }

    const reverseQty = Number(item.quantity || 0);
    const currentStockQty = Number(stockRow.productQuantity || 0);

    if (currentStockQty < reverseQty) {
      throw new ApiError(
        `Cannot reverse invoice. Product "${item.name}" does not have enough stock to reverse.`,
        400
      );
    }

    const batch = await prodcutBatchModel
      .findOne({
        productId: item.id,
        companyId,
        stockId: item.stock._id,
        sourceId: purchaseInvoice._id,
        sourceType: "purchase",
        status: "active",
      })
      .session(session);

    if (!batch) {
      throw new ApiError(
        `Active purchase batch not found for product "${item.name}"`,
        404
      );
    }

    if (Number(batch.remaining || 0) < reverseQty) {
      throw new ApiError(
        `Cannot reverse invoice. Batch for product "${item.name}" has already been used.`,
        400
      );
    }

    const currentAvgCost = Number(product.costBuyingPrice || 0);
    const cancelledCost = getOriginalBuyingPrice(item);
    const remainingQtyAfterReverse = currentStockQty - reverseQty;

    const reversedAvgCost =
      remainingQtyAfterReverse > 0
        ? (currentStockQty * currentAvgCost - reverseQty * cancelledCost) /
          remainingQtyAfterReverse
        : 0;

    bulkProductUpdates.push({
      updateOne: {
        filter: {
          _id: item.id,
          companyId,
          "stocks.stockId": item.stock._id,
        },
        update: {
          $inc: {
            "stocks.$.productQuantity": -reverseQty,
          },
          $set: {
            costBuyingPrice: reversedAvgCost < 0 ? 0 : reversedAvgCost,
          },
        },
      },
    });
  }

  if (bulkProductUpdates.length > 0) {
    await productModel.bulkWrite(bulkProductUpdates, { session });
  }

  for (const item of inventoryItems) {
    const product = productMap.get(item.id);
    if (!product) continue;

    const stockRow = (product.stocks || []).find(
      (stock) => String(stock.stockId) === String(item.stock._id)
    );

    const reverseQty = Number(item.quantity || 0);
    const currentStockQty = Number(stockRow?.productQuantity || 0);

    const batch = await prodcutBatchModel
      .findOne({
        productId: item.id,
        companyId,
        stockId: item.stock._id,
        sourceId: purchaseInvoice._id,
        sourceType: "purchase",
        status: "active",
      })
      .session(session);

    if (!batch) {
      throw new ApiError(
        `Active purchase batch not found for product "${item.name}"`,
        404
      );
    }

    const outPriceMainCurrrency = getMainCurrencyPrice(item);
    const movementExchangerate = getMovementExchangeRate(item);

    batch.status = currentMode.batchStatus;
    batch.reversedAt = cancellationDate;
    batch.reversedBy = reversedBy || null;
    batch.reverseReason = currentMode.reverseReason;
    batch.reverseSourceId = purchaseInvoice._id;
    batch.remaining = 0;

    await batch.save({ session });

    await batchLedgerModel.create(
      [
        {
          productId: item.id,
          companyId,
          stockId: item.stock?._id,
          type: "out",
          quantity: reverseQty,
          batchId: batch._id,
          referenceType: currentMode.referenceType,
          referenceId: purchaseInvoice._id,
          movementDate: cancellationDate,
        },
      ],
      { session }
    );

    await createProductMovement({
      productId: item.id,
      reference: purchaseInvoice._id,
      newQuantity: currentStockQty - reverseQty,
      quantity: reverseQty,
      movementType: "out",
      source: currentMode.movementSource,
      companyId,
      outPrice: getOriginalBuyingPrice(item),
      outPriceMainCurrrency,
      stockId: item.stock?._id,
      buyingPrice: getOriginalBuyingPrice(item),
      exchangeRate: movementExchangerate,
      movementDate: cancellationDate,
      session,
    });
  }
};
//  Purchase Supplier Effects
exports.applyPurchaseSupplierEffectsService = async ({
  invoicesItem,
  supplier,
  newPurchaseInvoice,
  companyId,
  currency,
  date,
  totalPurchasePriceMainCurrency,
  totalRemainderMainCurrency,
  paid,
  session,
}) => {
  if (!supplier) {
    throw new ApiError("Supplier not found", 404);
  }

  const totalMain = Number(totalPurchasePriceMainCurrency || 0);
  const remainderMain = Number(totalRemainderMainCurrency || 0);

  supplier.total += totalMain;

  supplier.TotalUnpaid += totalMain;

  for (const item of invoicesItem) {
    if (item.type === "unTracedproduct") {
      await unTracedproductLogModel.create(
        [
          {
            name: item.name,
            buyingPrice: item.convertedBuyingPrice || item.orginalBuyingPrice,
            type: "purchase",
            quantity: item.quantity,
            companyId,
          },
        ],
        { session }
      );
    }
  }

  await supplier.save({ session });

  await createPaymentHistoryV2({
    companyId,
    entryType: "invoice",
    transactionDate: date,
    amountTransactionCurrency: newPurchaseInvoice.invoiceGrandTotal,
    amountMainCurrency: totalMain,
    supplierId: supplier._id,
    referenceId: newPurchaseInvoice._id,
    sourceModule: "purchase",
    actionType: "create",
    transactionCurrency: currency.currencyCode,
    session,
  });
};

const PURCHASE_SUPPLIER_REVERSAL_MODES = {
  CANCEL: "cancel",
  REVERSE_UPDATE: "reverse_update",
};

exports.reversePurchaseSupplierEffectsService = async ({
  supplier,
  purchaseInvoice,
  companyId,
  currency,
  session,
  cancellationDate,
  mode = PURCHASE_SUPPLIER_REVERSAL_MODES.CANCEL,
}) => {
  if (!supplier) {
    throw new ApiError("Supplier not found", 404);
  }

  const reversalConfig = {
    [PURCHASE_SUPPLIER_REVERSAL_MODES.CANCEL]: {
      actionType: "cancel",
      sourceLabel: "Purchase invoice cancellation",
    },
    [PURCHASE_SUPPLIER_REVERSAL_MODES.REVERSE_UPDATE]: {
      actionType: "update",
      sourceLabel: "Purchase invoice reverse update",
    },
  };

  const currentMode = reversalConfig[mode];

  if (!currentMode) {
    throw new ApiError(`Invalid supplier reversal mode: ${mode}`, 400);
  }

  const totalMain = Number(purchaseInvoice.totalPurchasePriceMainCurrency || 0);
  const remainderMain = Number(purchaseInvoice.totalRemainderMainCurrency || 0);

  supplier.total = Number(supplier.total || 0) - totalMain;

  if (purchaseInvoice.paid === "unpaid") {
    supplier.TotalUnpaid = Number(supplier.TotalUnpaid || 0) - totalMain;
  }

  if (purchaseInvoice.paid === "paid") {
    supplier.TotalUnpaid = Number(supplier.TotalUnpaid || 0) - remainderMain;
  }

  if (supplier.total < 0) supplier.total = 0;
  if (supplier.TotalUnpaid < 0) supplier.TotalUnpaid = 0;

  await supplier.save({ session });

  await createPaymentHistoryV2({
    companyId,
    entryType: "invoice",
    transactionDate: cancellationDate,
    amountTransactionCurrency: Number(purchaseInvoice.invoiceGrandTotal || 0),
    amountMainCurrency: totalMain,
    supplierId: supplier._id,
    referenceId: purchaseInvoice._id,
    sourceModule: "purchase",
    actionType: currentMode.actionType,
    description: currentMode.sourceLabel,
    transactionCurrency: currency?.currencyCode || "",
    session,
  });
};
//  Purchase Journal Effects
exports.debugAndCreatePurchaseDraftJournalService = async ({
  companyId,
  purchaseInvoice,
  journalPreview,
  counterFormat,
  invoiceRefCounter,
  journalLinkCounter,
  session,
}) => {
  if (!journalPreview) {
    throw new ApiError("journal preview is required", 400);
  }

  const journalMeta = journalPreview?.journalMeta || {};
  const journalAccounts = journalPreview?.journalAccounts || [];

  if (!journalMeta?.journalName) {
    throw new ApiError("journal name is missing", 400);
  }

  if (!journalMeta?.journalDate) {
    throw new ApiError("journal date is missing", 400);
  }

  if (!Array.isArray(journalAccounts) || journalAccounts.length === 0) {
    throw new ApiError("journal accounts are missing", 400);
  }

  const totalDebit = journalAccounts.reduce(
    (sum, item) => sum + Number(item?.MainDebit || 0),
    0
  );

  const totalCredit = journalAccounts.reduce(
    (sum, item) => sum + Number(item?.MainCredit || 0),
    0
  );

  if (Number(totalDebit.toFixed(6)) !== Number(totalCredit.toFixed(6))) {
    throw new ApiError(
      `journal is not balanced. debit=${totalDebit}, credit=${totalCredit}`,
      400
    );
  }

  const journalPayload = {
    ...journalMeta,
    linkCounter: String(journalLinkCounter),
    refCounter: String(invoiceRefCounter || ""),
    counter: counterFormat,
    refId: purchaseInvoice?._id,
    party: journalMeta?.party || purchaseInvoice?.supllier?.id || "",
    journalType: journalMeta?.journalType || "Purchase",
    filesArray: [],
    journalDebit: totalDebit,
    journalCredit: totalCredit,
    journalAccounts,
  };

  const { journalAccounts: lines, ...journalInfo } = journalPayload;

  const createdJournal = await createJournalService({
    companyId,
    journalInfo,
    journalAccounts: lines,
    session,
  });

  return {
    createdJournal,
    journalPayload,
  };
};

exports.reversePurchaseJournalEffectsService = async ({
  companyId,
  purchaseInvoice,
  session,
  counterFormat,
  cancellationDate,
  reversalJournalLinkCounter,
  mode = "cancel",
}) => {
  if (!purchaseInvoice?.journalCounter) {
    throw new ApiError(
      "journal link reference is missing on purchase invoice",
      400
    );
  }

  const modeConfig = {
    cancel: {
      journalType: "Purchase Reversal",
      journalNamePrefix: "Purchase Invoice Cancellation",
      journalDescPrefix:
        "Journal entry created to reverse the accounting effect of the cancelled purchase invoice",
      originalStatus: "reversed",
    },
    reverse_update: {
      journalType: "Purchase Reverse Update",
      journalNamePrefix: "Purchase Invoice Update Reversal",
      journalDescPrefix:
        "Journal entry created to reverse the previous accounting effect before reposting the updated purchase invoice",
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
      linkCounter: purchaseInvoice.journalCounter,
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
    0
  );

  const totalCredit = reversedLines.reduce(
    (sum, item) => sum + Number(item?.MainCredit || 0),
    0
  );

  if (Number(totalDebit.toFixed(6)) !== Number(totalCredit.toFixed(6))) {
    throw new ApiError(
      `reversal journal is not balanced. debit=${totalDebit}, credit=${totalCredit}`,
      400
    );
  }

  const reversalJournalPayload = {
    journalName: `${currentMode.journalNamePrefix} - ${
      originalJournal?.journalName || purchaseInvoice?.invoiceName || ""
    }`,
    journalDate: cancellationDate,
    journalDesc: `${currentMode.journalDescPrefix} ${
      purchaseInvoice?.invoiceName || ""
    }`,
    journalType: currentMode.journalType,
    linkCounter: String(reversalJournalLinkCounter),
    refCounter: String(purchaseInvoice?.counter || ""),
    counter: counterFormat,
    refId: purchaseInvoice?._id,
    party: originalJournal?.party || purchaseInvoice?.supllier?.id || "",
    receiptNumber:
      originalJournal?.receiptNumber || purchaseInvoice?.invoiceNumber || "",
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

exports.updatePurchaseInvoiceDraftService = async ({
  req,
  companyId,
  session,
}) => {
  const invoiceId = req.params.id;

  if (!invoiceId) {
    throw new ApiError("Invoice id is required", 400);
  }

  const invoicesItem = req.body.invoicesItems
    ? JSON.parse(req.body.invoicesItems)
    : [];

  console.log("invoicesItem", invoicesItem);

  const currency = req.body.currency ? JSON.parse(req.body.currency) : {};
  const tag = req.body.tag ? JSON.parse(req.body.tag) : [];
  const taxDetails = req.body.taxDetails ? JSON.parse(req.body.taxDetails) : [];
  const supllierObject = req.body.supllierObject
    ? JSON.parse(req.body.supllierObject)
    : {};

  const existingInvoice = await PurchaseInvoicesModel.findOne({
    _id: invoiceId,
    companyId,
    isDraft: true,
  }).session(session);

  if (!existingInvoice) {
    throw new ApiError("Draft invoice not found", 404);
  }

  if (req.file?.filename && existingInvoice.file) {
    const oldFilePath = path.join(
      process.cwd(),
      "uploads",
      existingInvoice.file
    );

    if (fs.existsSync(oldFilePath)) {
      fs.unlinkSync(oldFilePath);
    }
  }

  const exchangeRate = Number(req.body.exchangeRate || 1);
  const totalInMainCurrency = Number(req.body.totalInMainCurrency || 0);
  const invoiceSubTotal = Number(req.body.invoiceSubTotal || 0);
  const subtotalWithDiscount = Number(req.body.subtotalWithDiscount || 0);
  const invoiceDiscount = Number(req.body.invoiceDiscount || 0);
  const invoiceGrandTotal = Number(req.body.invoiceGrandTotal || 0);
  const invoiceTax = Number(req.body.invoiceTax || 0);
  const manualInvoiceDiscount = Number(req.body.ManualInvoiceDiscount || 0);
  const manualInvoiceDiscountValue = Number(
    req.body.ManualInvoiceDiscountValue || 0
  );

  const paid = "unpaid";
  const paymentInInvoiceCurrency = 0;
  const paymentInMainCurrency = 0;
  const totalRemainder = invoiceGrandTotal;
  const totalRemainderMainCurrency = totalInMainCurrency;

  const normalizedDate = resolveInvoiceDate(
    existingInvoice.date,
    req.body.date
  );

  const updatePayload = {
    invoicesItems: invoicesItem,
    currency,
    tag,
    taxDetails,
    supllier: supllierObject,

    invoiceName: req.body.invoiceName,
    invoiceNumber: req.body.invoiceNumber,
    exchangeRate,

    totalPurchasePriceMainCurrency: totalInMainCurrency,
    invoiceSubTotal,
    subtotalWithDiscount,
    invoiceDiscount,
    invoiceGrandTotal,
    invoiceTax,

    InvoiceDiscountType: req.body.InvoiceDiscountType,
    ManualInvoiceDiscount: manualInvoiceDiscount,
    ManualInvoiceDiscountValue: manualInvoiceDiscountValue,

    paid,
    paymentInInvoiceCurrency,
    paymentInMainCurrency,
    totalRemainder,
    totalRemainderMainCurrency,

    date: normalizedDate,
    description: req.body.description || "",

    ...(req.file?.filename && { file: req.file.filename }),
  };

  const invoice = await PurchaseInvoicesModel.findOneAndUpdate(
    {
      _id: invoiceId,
      companyId,
      isDraft: true,
    },
    updatePayload,
    {
      new: true,
      session,
    }
  );

  await createInvoiceHistory(
    companyId,
    invoice._id,
    "edit",
    req.user._id,
    normalizedDate,
    "Draft purchase invoice updated",
    "purchase",
    session
  );

  return invoice;
};

exports.deletePurchaseInvoiceDraftService = async ({
  invoiceId,
  companyId,
  userId,
  session,
}) => {
  const invoice = await PurchaseInvoicesModel.findOne({
    _id: invoiceId,
    companyId,
    isDraft: true,
  }).session(session);

  if (!invoice) {
    throw new ApiError("Draft invoice not found", 404);
  }

  await PurchaseInvoicesModel.deleteOne(
    {
      _id: invoiceId,
      companyId,
      isDraft: true,
    },
    { session }
  );

  await createInvoiceHistory(
    companyId,
    invoiceId,
    "cancel",
    userId,
    new Date().toISOString(),
    "Draft purchase invoice deleted",
    "purchase",
    session
  );

  return true;
};

exports.paymentService = async ({
  req,
  companyId,
  session,
  newPurchaseInvoice,
  supplier,
}) => {
  const {
    party,

    paymentNature,

    paymentDate,
    description,
    journalCounter,
    counter,
    postedBy,
    postedAt,
    paymentInFundCurrency,
  } = req.body;

  const fund = req.body.fund ? JSON.parse(req.body.fund) : null;
  const payment = req.body.payment ? JSON.parse(req.body.payment) : null;

  if (!fund?.id) {
    throw new Error("Fund id is required");
  }

  if (!supplier?._id) {
    throw new Error("Party is required");
  }
  const financialFund = await financialFundsModel.findOneAndUpdate(
    { _id: fund.id || fund._id, companyId },
    { $inc: { fundBalance: -paymentInFundCurrency } },
    { new: true, session }
  );

  if (!financialFund) {
    throw new Error("Financial fund not found");
  }

  let paymentAmountMain = Number(payment.amountMainCurrency || 0);
  let paymentAmountInvoice =
    Number(payment.amountMainCurrency || 0) *
    Number(newPurchaseInvoice.currency?.exchangeRate || 1);

  const paymentSeq = await getNextCounterValue({
    companyId,
    name: "Payment",
    session,
  });
  const paymentPayload = {
    companyId,
    counter: Number(counter || 0) + Number(paymentSeq),
    party: {
      id: supplier._id,
      name: supplier.name,
      type: "supplier",
    },
    fund: {
      id: fund.id,
      name: fund.name,
      currencyId: fund.currencyId || "",
      currencyCode: fund.currencyCode || "",
      exchangeRate: Number(fund.exchangeRate || 1),
    },
    totalMainCurrency: paymentAmountMain,
    paymentNature: "outgoing",
    payment: {
      amount: Number(payment?.amount || 0),
      currencyId: payment?.currencyId || "",
      currencyCode: payment?.currencyCode || "",
      exchangeRate: Number(payment?.exchangeRate || 1),
      amountMainCurrency: Number(payment?.amountMainCurrency || 0),
    },
    date: paymentDate,
    description,
    journalCounter,
    file: req.body.file || "",
    allocations: [
      {
        documentId: newPurchaseInvoice._id,
        documentName: newPurchaseInvoice.invoiceName,
        documentCounter: newPurchaseInvoice.counter,
        documentCurrencyCode: newPurchaseInvoice.currency?.currencyCode || "",
        allocatedAmountMainCurrency: paymentAmountMain,
        allocatedAmountDocumentCurrency: paymentAmountInvoice,
        documentTotal: newPurchaseInvoice.invoiceGrandTotal,
        documentType: "purchase_invoice",
      },
    ],
    postedBy: postedBy || null,
    postedAt: postedAt || new Date(),
  };

  const paymentDocs = await paymentsModel.create([paymentPayload], {
    session,
  });
  const newPayment = paymentDocs[0];
  createdPayment = newPayment;

  if (newPurchaseInvoice.totalRemainderMainCurrency <= 0.9) {
    newPurchaseInvoice.paymentsStatus = "paid";
    newPurchaseInvoice.totalRemainderMainCurrency = 0;
    newPurchaseInvoice.totalRemainder = 0;
  }

  newPurchaseInvoice.payments.push({
    payment: Number(payment.amount || paymentAmountInvoice),
    paymentMainCurrency: payment.amountMainCurrency || paymentAmountMain,
    financialFunds: fund.name,
    paymentID: newPayment._id,
    financialFundsCurrencyCode: fund.currencyCode,
    exchangeRate: fund.exchangeRate,
    date: paymentDate,
    paymentInInvoiceCurrency:
      payment.amountMainCurrency * newPurchaseInvoice.currency.exchangeRate ||
      paymentAmountInvoice,
    financialFundsId: fund._id,
  });

  await newPurchaseInvoice.save({ session });

  await createInvoiceHistory(
    companyId,
    newPurchaseInvoice._id,
    "payment",
    req.user._id,
    paymentDate,
    `${payment.amount} ${fund.currencyCode}`,
    "invoice",
    session
  );

  supplier.TotalUnpaid = Number(supplier.TotalUnpaid || 0) - paymentAmountMain;
  if (supplier.TotalUnpaid < 0) supplier.TotalUnpaid = 0;
  await supplier.save({ session });

  await createPaymentHistoryV2({
    companyId,
    entryType: "payment",
    transactionDate: paymentDate,
    amountTransactionCurrency: paymentInFundCurrency,
    amountMainCurrency: payment.amountMainCurrency,
    supplierId: supplier._id,
    referenceId: newPurchaseInvoice._id,
    sourceModule: "payment",
    actionType: "create",
    paymentId: newPayment._id,
    balanceEffectType: "Deposit",
    description,
    transactionCurrency: fund.currencyCode,
    session,
  });

  await reportsFinancialFunds.create(
    [
      {
        date: paymentDate,
        amount: Number(paymentInFundCurrency || 0),
        ref: newPurchaseInvoice._id,
        type: "Withdrawal",
        financialFundId: financialFund._id,
        financialFundRest: financialFund.fundBalance,
        exchangeRate: newPurchaseInvoice.currency?.exchangeRate || 1,
        paymentType: "Withdrawal",
        payment: newPayment._id,
        description,
        companyId,
      },
    ],
    { session }
  );
  return true;
};
