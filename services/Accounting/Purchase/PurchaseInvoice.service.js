// ===== Core Packages =====
const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const multer = require("multer");

// ===== Utilities =====
const ApiError = require("../../../utils/apiError");
const { createProductMovement } = require("../../../utils/productMovement");

// ===== Services =====
const { createInvoiceHistory } = require("../../invoiceHistoryService");
const { createPaymentHistory } = require("../../paymentHistoryService");
const { createProductBatch } = require("../../productBatchServices");

// ===== Models =====
const PurchaseInvoicesModel = require("../../../models/purchaseinvoicesModel");
const suppliersModel = require("../../../models/suppliersModel");
const financialFundsModel = require("../../../models/financialFundsModel");
const productModel = require("../../../models/productModel");
const PaymentModel = require("../../../models/paymentModel");
const reportsFinancialFunds = require("../../../models/reportsFinancialFunds");
const refundPurchaseInviceModel = require("../../../models/refundPurchaseInviceModel");
const paymentHistoryModel = require("../../../models/paymentHistoryModel");
const invoiceHistoryModel = require("../../../models/invoiceHistoryModel");
const unTracedproductLogModel = require("../../../models/unTracedproductLogModel");
const ShortageModel = require("../../../models/ShortageModel");
const prodcutBatchModel = require("../../../models/prodcutBatchModel");
const { createJournalService } = require("../../journalEntryServices");

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

exports.uploadFile = upload.single("file");

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

  let financialFund = null;
  let parsedFinancialFund = null;

  if (req.body.financailFund) {
    parsedFinancialFund =
      typeof req.body.financailFund === "string"
        ? JSON.parse(req.body.financailFund)
        : req.body.financailFund;
  }

  /*
      =============================
      HANDLE PAYMENT FUND
      =============================
    */
  if (paid === "paid" && !invoiceDraft) {
    financialFund = await financialFundsModel
      .findOne({ _id: parsedFinancialFund?.id, companyId })
      .session(session);

    if (!financialFund) {
      throw new ApiError("Financial fund not found", 404);
    }

    financialFund.fundBalance -= Number(paymentInFundCurrency || 0);
  }

  /*
      =============================
      SUPPLIER BALANCE UPDATE
      =============================
    */
  if (!invoiceDraft) {
    if (!supplier) {
      throw new ApiError("Supplier not found", 404);
    }

    supplier.total += Number(totalInMainCurrency || 0);

    if (paid === "unpaid") {
      supplier.TotalUnpaid += Number(totalInMainCurrency || 0);
    }

    if (paid === "paid") {
      supplier.TotalUnpaid += Number(totalRemainderMainCurrency || 0);
    }
  }

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

  if (paid === "paid" && !invoiceDraft) {
    invoicePayload.financailFund = parsedFinancialFund;
    invoicePayload.paymentInFundCurrency = paymentInFundCurrency;
  }

  if (paid === "unpaid") {
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
  if (paid === "paid" && !invoiceDraft) {
    const payment = await PaymentModel.create(
      [
        {
          source: {
            id: supllierObject.id,
            name: supllierObject.name,
          },
          destination: {
            id: financialFund._id,
            name: financialFund.fundName,
          },
          sourceType: "purchase",
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
              id: newPurchaseInvoice._id,
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
      { session }
    );

    await createPaymentHistory(
      "payment",
      req.body.paymentDate || formattedDate,
      req.body.paymentInMainCurrency,
      paymentInFundCurrency,
      "supplier",
      supllierObject.id,
      newPurchaseInvoice._id,
      companyId,
      req.body.paymentDescription,
      payment[0]._id,
      "Deposit",
      "purchase",
      parsedFinancialFund?.code,
      session
    );
    const reports = await reportsFinancialFunds.create(
      [
        {
          date: req.body.paymentDate || formattedDate,
          ref: newPurchaseInvoice._id,
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
      { session }
    );

    newPurchaseInvoice.payments.push({
      payment: paymentInFundCurrency,
      paymentMainCurrency: req.body.paymentInMainCurrency,
      financialFunds: financialFund.fundName,
      financialFundsCurrencyCode: parsedFinancialFund?.code,
      date: req.body.paymentDate || formattedDate,
      paymentID: payment[0]._id,
      paymentInInvoiceCurrency: req.body.paymentInInvoiceCurrency,
      financialFundsId: parsedFinancialFund?.id,
    });

    newPurchaseInvoice.reportsBalanceId = reports[0]._id;

    await newPurchaseInvoice.save({ session });
    await financialFund.save({ session });
  }

  /*
      =============================
      SAVE SUPPLIER
      =============================
    */
  if (!invoiceDraft) {
    await supplier.save({ session });
  }

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

  if (paid === "paid" && !invoiceDraft) {
    await createInvoiceHistory(
      companyId,
      newPurchaseInvoice._id,
      "payment",
      req.user._id,
      req.body.paymentDate || formattedDate,
      "Invoice payment recorded",
      "purchase",
      session
    );
  }

  return newPurchaseInvoice;
};

exports.applyPurchaseInventoryEffectsService = async ({
  invoicesItem,
  productMap,
  newPurchaseInvoice,
  companyId,
  date,
  session,
}) => {
  const bulkProductUpdates = invoicesItem
    .filter(
      (item) => item.type !== "unTracedproduct" && item.type !== "expense"
    )
    .map((item) => {
      const product = productMap.get(item.id);
      if (!product || !item.stock?._id) return null;

      const oldQty = (product.stocks || []).reduce(
        (total, stock) => total + (stock.productQuantity || 0),
        0
      );

      const oldCost = product.costBuyingPrice || 0;
      const newQty = Number(item.quantity) || 0;
      const newCost = Number(item.oldCostBuyingPrice) || 0;

      const newAvgCost =
        oldQty + newQty > 0
          ? (oldQty * oldCost + newQty * newCost) / (oldQty + newQty)
          : newCost;

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
              buyingprice: item.orginalBuyingPrice,
              costBuyingPrice: newAvgCost,
            },
          },
        },
      };
    })
    .filter(Boolean);

  const bulkProductInserts = invoicesItem
    .filter(
      (item) => item.type !== "unTracedproduct" && item.type !== "expense"
    )
    .filter((item) => item.stock?._id)
    .map((item) => ({
      updateOne: {
        filter: {
          _id: item.id,
          companyId,
          "stocks.stockId": { $ne: item.stock._id },
        },
        update: {
          $set: {
            buyingprice: item.orginalBuyingPrice,
          },
          $push: {
            stocks: {
              stockId: item.stock._id,
              stockName: item.stock.stock,
              productQuantity: Number(item.quantity) || 0,
            },
          },
        },
      },
    }));

  const bulkOperations = [...bulkProductUpdates, ...bulkProductInserts];

  if (bulkOperations.length > 0) {
    await productModel.bulkWrite(bulkOperations, { session });
  }

  for (const item of invoicesItem) {
    if (item.type === "unTracedproduct" || item.type === "expense") continue;

    const product = productMap.get(item.id);
    if (!product) continue;

    const totalStockQuantity = (product.stocks || []).reduce(
      (total, stock) => total + (stock.productQuantity || 0),
      0
    );

    await createProductMovement({
      productId: item.id,
      reference: newPurchaseInvoice._id,
      newQuantity: totalStockQuantity + Number(item.quantity || 0),
      quantity: item.quantity,
      movementType: "in",
      source: "Purchase Invoice",
      companyId,
      enterPrice: item.oldCostBuyingPrice,
      stockId: item.stock?._id,
      buyingPrice: item.orginalBuyingPrice,
      exchangeRate: item.exchangeRate,
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
      costBuyingPrice: item.oldCostBuyingPrice,
      exchangeRate: item.exchangeRate,
      referenceType: "purchase",
      batchDate: date,
      session,
    });
  }
};

exports.applyPurchaseSupplierEffectsService = async ({
  invoicesItem,
  supplier,
  newPurchaseInvoice,
  companyId,
  currency,
  date,
  totalPurchasePriceMainCurrency,
  session,
}) => {
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

  await createPaymentHistory(
    "invoice",
    date,
    totalPurchasePriceMainCurrency,
    newPurchaseInvoice.invoiceGrandTotal,
    "supplier",
    supplier._id,
    newPurchaseInvoice._id,
    companyId,
    "",
    "",
    "",
    "",
    currency.currencyCode,
    session
  );
};

exports.debugAndCreatePurchaseDraftJournalService = async ({
  companyId,
  purchaseInvoice,
  journalPreview,
  session,
}) => {
  if (!companyId) {
    throw new ApiError("companyId is required", 400);
  }

  if (!purchaseInvoice) {
    throw new ApiError("purchase invoice is required", 400);
  }

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

  for (const line of journalAccounts) {
    if (!line?.id) {
      throw new ApiError(
        `journal account id is missing in line type ${
          line?.accountType || "unknown"
        }`,
        400
      );
    }
  }

  const totalDebit = journalAccounts.reduce(
    (sum, item) => sum + Number(item?.MainDebit || 0),
    0
  );

  const totalCredit = journalAccounts.reduce(
    (sum, item) => sum + Number(item?.MainCredit || 0),
    0
  );

  const balanced =
    Number(totalDebit.toFixed(6)) === Number(totalCredit.toFixed(6));

  if (!balanced) {
    throw new ApiError(
      `journal is not balanced. debit=${totalDebit}, credit=${totalCredit}`,
      400
    );
  }

  const journalPayload = {
    ...journalMeta,
    journalAccounts,
    journalDebit: totalDebit,
    journalCredit: totalCredit,
    filesArray: [],
    refId: journalMeta?.refId || purchaseInvoice?._id,
    refCounter: journalMeta?.refCounter || purchaseInvoice?.counter,
    party: journalMeta?.party || purchaseInvoice?.supllier?.id || "",
    journalType: journalMeta?.journalType || "Purchase",
  };

  console.group("Post Draft Invoice Journal Debug");
  console.log("invoiceId:", purchaseInvoice?._id?.toString());
  console.log("journalPayload:", journalPayload);
  console.log("totalDebit:", totalDebit);
  console.log("totalCredit:", totalCredit);
  console.groupEnd();

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
    totalDebit,
    totalCredit,
  };
};

exports.createJournalFromService = async ({
  journalMeta,
  journalAccounts,
  companyId,
  session,
}) => {
  const created = await journalModel.create(
    [
      {
        ...journalMeta,
        journalAccounts,
        companyId,
      },
    ],
    { session }
  );

  const createdJournal = created[0];

  const updateOperations = journalAccounts.map((item) => ({
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

  await AccountModel.bulkWrite(updateOperations, { session });

  return createdJournal;
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

  /*
  =============================
  PARSE BODY DATA
  =============================
  */

  const invoicesItem = req.body.invoicesItems
    ? JSON.parse(req.body.invoicesItems)
    : [];

  const currency = req.body.currency ? JSON.parse(req.body.currency) : {};

  const tag = req.body.tag ? JSON.parse(req.body.tag) : [];

  const taxDetails = req.body.taxDetails ? JSON.parse(req.body.taxDetails) : [];

  const supllierObject = req.body.supllierObject
    ? JSON.parse(req.body.supllierObject)
    : {};

  /*
  =============================
  FIND EXISTING INVOICE
  =============================
  */

  const existingInvoice = await PurchaseInvoicesModel.findOne({
    _id: invoiceId,
    companyId,
    isDraft: true,
  }).session(session);

  if (!existingInvoice) {
    throw new ApiError("Draft invoice not found", 404);
  }

  /*
  =============================
  DELETE OLD FILE IF REPLACED
  =============================
  */

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

  /*
  =============================
  BUILD UPDATE PAYLOAD
  =============================
  */

  const updatePayload = {
    invoicesItems: invoicesItem,
    currency,
    tag,
    taxDetails,
    supllier: supllierObject,

    invoiceName: req.body.invoiceName,
    invoiceNumber: req.body.invoiceNumber,
    exchangeRate: req.body.exchangeRate,

    totalPurchasePriceMainCurrency: req.body.totalInMainCurrency,
    invoiceSubTotal: req.body.invoiceSubTotal,
    subtotalWithDiscount: req.body.subtotalWithDiscount,
    invoiceDiscount: req.body.invoiceDiscount,
    invoiceGrandTotal: req.body.invoiceGrandTotal,
    invoiceTax: req.body.invoiceTax,

    InvoiceDiscountType: req.body.InvoiceDiscountType,
    ManualInvoiceDiscount: req.body.ManualInvoiceDiscount,
    ManualInvoiceDiscountValue: req.body.ManualInvoiceDiscountValue,

    date: req.body.date,
    description: req.body.description,

    ...(req.file?.filename && { file: req.file.filename }),
  };

  /*
  =============================
  UPDATE INVOICE
  =============================
  */

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

  /*
  =============================
  CREATE HISTORY RECORD
  =============================
  */

  await createInvoiceHistory(
    companyId,
    invoice._id,
    "edit",
    req.user._id,
    req.body.date,
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
