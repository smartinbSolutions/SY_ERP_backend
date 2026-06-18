const customarModel = require("../../../models/Accounting/Sales/customarModel");
const financialFundsModel = require("../../../models/Accounting/CurrentAssets/financialFundsModel");
const journalEntryModel = require("../../../models/journalEntryModel");
const orderModel = require("../../../models/Accounting/Sales/orderModel");
const paymentModel = require("../../../models/paymentModel");
const prodcutBatchModel = require("../../../models/Stocks/products/prodcutBatchModel");
const productLedgerModel = require("../../../models/Stocks/products/batchLedgerModel");
const productModel = require("../../../models/Stocks/products/productModel");
const reportsFinancialFunds = require("../../../models/Accounting/CurrentAssets/reportsFinancialFunds");
const ApiError = require("../../../utils/apiError");
const { createProductMovement } = require("../../../utils/productMovement");
const { createInvoiceHistory } = require("../../invoiceHistoryService");
const {
  createJournalService,
  createJournalServiceV2,
  createJournalEntryService,
} = require("../../Accounting/JournalEntries/journalEntries.Service");
const { createPaymentHistoryV2 } = require("../../paymentHistoryService");
const invoiceHistoryModel = require("../../../models/invoiceHistoryModel");
const batchLedgerModel = require("../../../models/Stocks/products/batchLedgerModel");
const { ExpressValidator } = require("express-validator");
const { getNextCounterValue } = require("../../../utils/getNextCounterValue");
const paymentsModel = require("../../../models/Accounting/CurrentAssets/payments.model");
const counterModel = require("../../../models/Settings/counterModel");
const unTracedproductLogModel = require("../../../models/unTracedproductLogModel");

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
exports.prepareSalesInvoiceDataService = async ({
  req,
  companyId,
  session,
}) => {
  // Time formatting helper
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

  // Parse JSON fields
  const customerObject = req.body.customer
    ? JSON.parse(req.body.customer)
    : req.body.customer;

  const taxSummary = req.body.taxSummary ? JSON.parse(req.body.taxSummary) : "";

  const invoicesItem = req.body.invoicesItems
    ? JSON.parse(req.body.invoicesItems)
    : "";

  const currency = req.body.currency ? JSON.parse(req.body.currency) : "";

  const tag = req.body.tag ? JSON.parse(req.body.tag) : "";

  const customer = await customarModel
    .findOne({
      _id: customerObject.id,
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
    customer,
    invoicesItem,
    customerObject,
    taxSummary,
    currency,
    tag,
    formattedDate,
    productMap,
    draftJournalSnapshot,
  };
};
exports.prepareSalesInvoiceDataFromDraftService = async ({
  salesInvoice,
  companyId,
  session,
}) => {
  const customerObject = salesInvoice.customer || {};
  const taxSummary = salesInvoice.taxSummary || [];
  const invoicesItem = salesInvoice.invoicesItems || [];
  const currency = salesInvoice.currency || {};
  const tag = salesInvoice.tag || [];

  const customer = await customarModel
    .findOne({
      _id: customerObject.id,
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
    customer,
    invoicesItem,
    customerObject,
    taxSummary,
    currency,
    tag,
    productMap,
  };
};

exports.createSalesInvoiceRecordService = async ({
  req,
  invoiceDraft,
  customer,
  invoicesItem,
  customerObject,
  currency,
  taxSummary,
  tag,
  formattedDate,
  companyId,
  nextCounterPayment,
  draftJournalSnapshot,
  nextCounterSalesInvoices,
  session,
}) => {
  const {
    paymentsStatus,
    currencyExchangeRate,
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

  // ── Invoice totals ─────────────────────────────────────────────
  const invoiceTotalMain = Number(totalInMainCurrency || 0);
  const invoiceTotalInvoice = Number(invoiceGrandTotal || 0);

  // ── Draft: use whatever the frontend sends (may be partial) ───
  // ── Posted: always start with FULL remainder + "unpaid"
  //    handleSalesPayment will close it and set paymentsStatus = "paid"
  //    This is the correct separation:
  //      createRecord  → creates the raw invoice (always unpaid, full remainder)
  //      handlePayment → applies payment, sets status, reduces remainder
  const resolvedPaymentsStatus = "unpaid";
  const resolvedRemainderMain = invoiceTotalMain;
  const resolvedRemainder = invoiceTotalInvoice;

  const invoicePayload = {
    employee: { id: req.user._id, name: req.user.name },
    invoicesItems: invoicesItem,
    customer: customerObject,
    currency,
    currencyExchangeRate,
    invoiceNumber,
    paymentsStatus: invoiceDraft ? "unpaid" : resolvedPaymentsStatus, // ✅ always unpaid initially
    totalInMainCurrency: totalInMainCurrency,
    invoiceSubTotal,
    subtotalWithDiscount,
    invoiceDiscount,
    InvoiceDiscountType,
    ManualInvoiceDiscount,
    ManualInvoiceDiscountValue,
    invoiceGrandTotal,
    taxSummary,
    invoiceTax,
    invoiceName,
    tag,
    companyId,
    orderDate: req.body.date || formattedDate,
    journalCounter,
    description,
    file: req.body.file,
    paymentDate,

    // ✅ always full remainder — handleSalesPayment will reduce this
    totalRemainder: invoiceDraft
      ? totalRemainder // draft → keep what frontend sent
      : resolvedRemainder, // posted → full invoice amount

    totalRemainderMainCurrency: invoiceDraft
      ? totalRemainderMainCurrency // draft → keep what frontend sent
      : resolvedRemainderMain, // posted → full invoice amount in main currency

    status: req.body.status,
    isDraft: invoiceDraft,
    postedBy: invoiceDraft ? null : req.user._id,
    postedAt: invoiceDraft ? null : new Date(),
    returnCartItem: invoicesItem,
  };

  if (!invoiceDraft) {
    invoicePayload.counter =
      Number(req.body.counter || 0) + nextCounterSalesInvoices.seq;
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

  // ✅ dueDate only for unpaid posted invoices (matches purchase intent)
  if (!invoiceDraft && resolvedPaymentsStatus === "unpaid") {
    invoicePayload.dueDate = paymentDate;
  }

  const createdInvoice = await orderModel.create([invoicePayload], {
    session,
  });

  const newSalesInvoice = createdInvoice[0];

  await createInvoiceHistory(
    companyId,
    newSalesInvoice._id,
    "create",
    req.user._id,
    req.body.date || formattedDate,
    invoiceDraft ? "Sales invoice draft created" : "Sales invoice created",
    "Sales",
    session,
  );

  return newSalesInvoice;
};

exports.applySalesInventoryEffectsService = async ({
  invoicesItem,
  productMap,
  newSalesInvoice,
  companyId,
  date,
  session,
  actionType = "",
}) => {
  const bulkOperations = [];

  for (let index = 0; index < invoicesItem.length; index++) {
    const item = invoicesItem[index];

    if (item.type === "expense") {
      continue;
    } else if (item.type === "unTracedproduct") {
      await unTracedproductLogModel.create(
        [
          {
            type: "out",
            name: item.name,
            quantity: Number(item.quantity || item.soldQuantity || 0),
            outPrice: item.sellingPrice,
            totalWithoutTax: item.totalWithoutTax,
            total: item.total,
            tax: { _id: item.tax, taxValue: item.taxValue },
            sourceModule: "Sales Invoice",
            reference: newSalesInvoice._id,
            referenceModel: "sales",
            companyId,
          },
        ],
        { session },
      );
    } else if (item.type === "Service") {
      await createProductMovement({
        productId: item.id,
        reference: newSalesInvoice._id,
        newQuantity: 0,
        quantity: item.soldQuantity,
        movementType: "in",
        source: "Sales Invoice",
        companyId,
        outPrice: item.sellingPrice,
        stockId: null,
        buyingPrice: item.orginalBuyingPrice || 0,
        exchangeRate: item.exchangeRate,
        movementDate: new Date(),
        session,
      });
    } else if (item.type === "product") {
      const product = productMap.get(item.id);

      if (!product || !item.stock?._id) {
        continue;
      }

      const soldQty = Number(item.quantity || item.soldQuantity || 0);

      const stockRow = (product.stocks || []).find(
        (s) => String(s.stockId) === String(item.stock._id),
      );

      const oldQty = Number(stockRow?.productQuantity || 0);

      if (soldQty > oldQty) {
        throw new ApiError(
          `Insufficient stock for product ${product.name}`,
          400,
        );
      }

      let qtyToSell = soldQty;
      const fifoMovements = [];
      const itemBatches = [];

      const batches = await prodcutBatchModel
        .find({
          productId: item.id,
          companyId,
          stockId: item.stock._id,
          remaining: { $gt: 0 },
        })
        .sort({ createdAt: 1 })
        .session(session);

      for (const batch of batches) {
        if (qtyToSell <= 0) break;

        const available = Number(batch.remaining || 0);
        if (available <= 0) continue;

        const usedQty = Math.min(available, qtyToSell);

        batch.remaining = Math.max(0, batch.remaining - usedQty);

        await batch.save({ session });

        itemBatches.push({
          id: batch._id.toString(),
          quantity: usedQty,
        });

        fifoMovements.push({
          quantity: usedQty,
          costBuyingPrice: batch.buyingprice,
          batchId: batch._id,
        });

        qtyToSell -= usedQty;
      }

      if (qtyToSell > 0) {
        throw new ApiError(
          `Insufficient stock for product ${product.name}`,
          400,
        );
      }

      // 🔥 IMPORTANT: NO .find() → USE INDEX (each line is unique)
      const invoiceItem = newSalesInvoice.invoicesItems[index];
      const returnCartItem = newSalesInvoice.returnCartItem?.[index];

      if (invoiceItem) {
        invoiceItem.batches = itemBatches;
      }

      if (returnCartItem) {
        returnCartItem.batches = itemBatches;
      }

      let soldTotalCost = 0;

      for (const fm of fifoMovements) {
        soldTotalCost += fm.quantity * fm.costBuyingPrice;

        await batchLedgerModel.create(
          [
            {
              productId: item.id,
              companyId,
              stockId: item.stock._id,
              type: "out",
              quantity: fm.quantity,
              batchId: fm.batchId,
              referenceType: "sales",
              referenceId: newSalesInvoice._id,
              movementDate: date,
              actionType,
            },
          ],
          { session },
        );

        await createProductMovement({
          productId: item.id,
          reference: newSalesInvoice._id,
          newQuantity: oldQty - fm.quantity,
          quantity: fm.quantity,
          movementType: "out",
          source: "Sales Invoice",
          companyId,
          outPrice: fm.costBuyingPrice,
          stockId: item.stock._id,
          sellingPrice: item.sellingPrice,
          exchangeRate: item.exchangeRate,
          movementDate: date,
          session,
        });
      }

      const oldAvgCost = Number(product.costBuyingPrice || 0);
      const remainingQty = oldQty - soldQty;

      let newAvgCost = 0;

      if (remainingQty > 0) {
        newAvgCost = (oldQty * oldAvgCost - soldTotalCost) / remainingQty;
      }

      if (!Number.isFinite(newAvgCost)) {
        newAvgCost = 0;
      }

      bulkOperations.push({
        updateOne: {
          filter: {
            _id: item.id,
            companyId,
            "stocks.stockId": item.stock._id,
          },
          update: {
            $inc: {
              "stocks.$.productQuantity": -soldQty,
              soldByMonth: soldQty,
              soldByWeek: soldQty,
              sold: soldQty,
            },
            $set: {
              costBuyingPrice: newAvgCost,
            },
          },
        },
      });
    }
  }

  await newSalesInvoice.save({ session });

  if (bulkOperations.length > 0) {
    await productModel.bulkWrite(bulkOperations, { session });
  }
};

exports.applySalesCustomerEffectsService = async ({
  customer,
  newSalesInvoice,
  companyId,
  currency,
  date,
  totalRemainderMainCurrency,
  totalSalesPriceMainCurrency,
  paymentsStatus,
  session,
}) => {
  if (!customer) {
    throw new ApiError("Customer not found", 404);
  }

  const totalMain = Number(totalSalesPriceMainCurrency || 0);

  await createPaymentHistoryV2({
    companyId,
    entryType: "invoice",
    transactionDate: date,
    amountTransactionCurrency: newSalesInvoice.invoiceGrandTotal,
    amountMainCurrency: totalMain,
    customerId: customer._id,
    referenceId: newSalesInvoice._id,
    sourceModule: "sales",
    actionType: "create",
    description: newSalesInvoice.description,
    transactionCurrency: currency?.currencyCode,
    session,
  });
};

exports.debugAndCreateSalesDraftJournalService = async ({
  companyId,
  salesInvoice,
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

  if (!journalMeta?.journalName)
    throw new ApiError("journal name is missing", 400);
  if (!journalMeta?.journalDate)
    throw new ApiError("journal date is missing", 400);
  if (!Array.isArray(journalAccounts) || journalAccounts.length === 0) {
    throw new ApiError("journal accounts are missing", 400);
  }

  const totalDebit = journalAccounts.reduce(
    (sum, item) => sum + Number(item?.MainDebit || 0),
    0,
  );
  const totalCredit = journalAccounts.reduce(
    (sum, item) => sum + Number(item?.MainCredit || 0),
    0,
  );

  if (Number(totalDebit.toFixed(6)) !== Number(totalCredit.toFixed(6))) {
    throw new ApiError(
      `journal is not balanced. debit=${totalDebit}, credit=${totalCredit}`,
      400,
    );
  }

  // ── Get journal counter ────────────────────────────────────────
  const nextCounterJournal = await counterModel.findOneAndUpdate(
    { companyId, name: "Journal" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session },
  );

  // ── Save using same service as purchase ───────────────────────
  const createdJournal = await createJournalEntryService({
    data: {
      ...journalMeta,
      journalAccounts,
      linkCounter: String(journalLinkCounter),
      refCounter: String(invoiceRefCounter || ""),
      counter: counterFormat,
      refId: salesInvoice?._id,
      party: journalMeta?.party || salesInvoice?.customer?.id || "",
      journalType: journalMeta?.journalType || "Sales",
      filesArray: [],
      journalDebit: totalDebit,
      journalCredit: totalCredit,
    },
    companyId,
    nextCounterJournal,
    session,
  });

  return { createdJournal };
};

exports.updateSalesInvoiceDraftService = async ({
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

  const currency = req.body.currency ? JSON.parse(req.body.currency) : "";

  const tag = req.body.tag ? JSON.parse(req.body.tag) : "";
  const taxSummary = req.body.taxSummary ? JSON.parse(req.body.taxSummary) : "";
  const customerObject = req.body.customer ? JSON.parse(req.body.customer) : "";

  const existingInvoice = await orderModel
    .findOne({
      _id: invoiceId,
      companyId,
      isDraft: true,
    })
    .session(session);

  if (!existingInvoice) {
    throw new ApiError("Draft invoice not found", 404);
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
    req.body.ManualInvoiceDiscountValue || 0,
  );

  const paid = "unpaid";
  const paymentInInvoiceCurrency = 0;
  const paymentInMainCurrency = 0;
  const totalRemainder = invoiceGrandTotal;
  const totalRemainderMainCurrency = totalInMainCurrency;
  console.log(req.body);
  const normalizedDate = resolveInvoiceDate(
    existingInvoice.orderDate,
    req.body.orderDate,
  );

  const updatePayload = {
    invoicesItems: invoicesItem,
    currency,
    tag,
    taxSummary,
    customer: customerObject,
    returnCartItem: invoicesItem,
    invoiceName: req.body.invoiceName,
    invoiceNumber: req.body.invoiceNumber,
    exchangeRate,

    totalInMainCurrency: totalInMainCurrency,
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

    orderDate: normalizedDate,
    description: req.body.description || "",
    currencyExchangeRate: req.body.currencyExchangeRate,
    shipmentNumber: req.body.shipmentNumber || "", // ← added
    shipmentDate: req.body.shipmentDate || null, // ← added
  };

  const invoice = await orderModel.findOneAndUpdate(
    {
      _id: invoiceId,
      companyId,
      isDraft: true,
    },
    updatePayload,
    {
      new: true,
      session,
    },
  );

  await createInvoiceHistory(
    companyId,
    invoice._id,
    "edit",
    req.user._id,
    normalizedDate,
    "Draft Sales invoice updated",
    "sales",
    session,
  );

  return invoice;
};

exports.deleteSalesInvoiceDraftService = async ({
  invoiceId,
  companyId,
  session,
}) => {
  const invoice = await orderModel
    .findOne({
      _id: invoiceId,
      companyId,
      isDraft: true,
    })
    .session(session);

  if (!invoice) {
    throw new ApiError("Draft invoice not found", 404);
  }

  await orderModel.deleteOne(
    {
      _id: invoiceId,
      companyId,
      isDraft: true,
    },
    { session },
  );

  return true;
};

// reverse
exports.reverseSalesInventoryEffectsService = async ({
  invoicesItem,
  productMap,
  salesInvoice,
  companyId,
  session,
  reversedBy,
  reverseReason,
  cancellationDate,
  mode = "cancel",
}) => {
  const resolveItemCost = (item) =>
    Number(
      item?.draftCostBuyingPrice ??
        item?.oldCostBuyingPrice ??
        item?.orginalBuyingPrice ??
        0,
    );

  const reversalConfig = {
    cancel: {
      reverseReason: reverseReason || "Sales invoice cancellation",
      referenceType: "sales_cancel",
      movementSource: "Sales Invoice Cancellation",
      actionType: "cancel",
    },
    reverse_update: {
      reverseReason: reverseReason || "Sales invoice reverse update",
      referenceType: "sales_reverse_update",
      movementSource: "Sales Invoice Reverse Update",
      actionType: "update",
    },
  };
  let currentStockQty = 0;
  const currentMode = reversalConfig[mode];
  if (!currentMode) {
    throw new ApiError(`Invalid reversal mode: ${mode}`, 400);
  }

  const bulkProductUpdates = [];

  for (const item of invoicesItem) {
    if (item.type === "expense") continue;
    else if (item.type === "unTracedproduct") {
      await unTracedproductLogModel.create(
        [
          {
            type: "out",
            name: item.name,
            quantity: item.soldQuantity,
            enterPrice: item.sellingPrice,
            totalWithoutTax: item.totalWithoutTax,
            total: item.total,
            tax: { _id: item.tax, taxValue: item.taxValue },
            sourceModule: currentMode.movementSource,
            reference: salesInvoice._id,
            referenceModel: "sales",
            companyId,
          },
        ],
        { session },
      );
    } else if (item.type === "Service") {
      await createProductMovement({
        productId: item.id,
        reference: salesInvoice._id,
        newQuantity: 0,
        quantity: item.soldQuantity,
        movementType: "in",
        source: currentMode.movementSource,
        companyId,
        enterPrice: item.orginalBuyingPrice || 0,
        stockId: null,
        buyingPrice: item.orginalBuyingPrice || 0,
        exchangeRate: item.exchangeRate,
        movementDate: new Date(),
        session,
      });
    } else if (item.type === "product") {
      const product = productMap.get(item.id);

      if (!product) {
        throw new ApiError(`Product not found for item ${item.name}`, 404);
      }

      if (!item.stock?._id) {
        throw new ApiError(`Stock is missing for item ${item.name}`, 400);
      }

      const stockRow = (product.stocks || []).find(
        (s) => String(s.stockId) === String(item.stock._id),
      );

      if (!stockRow) {
        throw new ApiError(`Stock row not found for product ${item.name}`, 400);
      }
      currentStockQty = Number(stockRow?.productQuantity || 0);

      const reverseQty = Number(item.soldQuantity || 0);
      bulkProductUpdates.push({
        updateOne: {
          filter: {
            _id: item.id,
            companyId,
            "stocks.stockId": item.stock._id,
          },
          update: {
            $inc: {
              "stocks.$.productQuantity": reverseQty,
            },
          },
        },
      });
    }

    if (bulkProductUpdates.length > 0) {
      await productModel.bulkWrite(bulkProductUpdates, { session });
    }

    for (const item of invoicesItem) {
      if (
        item.type === "unTracedproduct" ||
        item.type === "expense" ||
        item.type === "Service"
      )
        continue;
      const product = productMap.get(item.id);

      let reverseQty = Number(item.soldQuantity || 0);

      for (const batchItem of item.batches) {
        const batch = await prodcutBatchModel
          .findById(batchItem.id)
          .session(session);

        if (!batch) {
          throw new ApiError(`Batch not found ${batchItem.id}`, 404);
        }

        const qtyToRestore = Number(batchItem.quantity || 0);

        if (qtyToRestore <= 0) continue;

        batch.remaining = Number(batch.remaining || 0) + qtyToRestore;

        batch.status = "active";
        batch.reversedBy = reversedBy;
        await batchLedgerModel.create(
          [
            {
              productId: item.id,
              companyId,
              stockId: item.stock?._id,
              type: "in",
              quantity: batchItem.quantity,
              batchId: batch._id,
              referenceType: "sales",
              referenceId: salesInvoice._id,
              movementDate: cancellationDate,
              actionType: currentMode.actionType,
            },
          ],
          { session },
        );

        await batch.save({ session });

        await createProductMovement({
          productId: item.id,
          reference: salesInvoice._id,
          newQuantity: currentStockQty + batchItem.quantity,
          quantity: batchItem.quantity,
          movementType: "in",
          source: currentMode.movementSource,
          companyId,
          enterPrice: batch.buyingprice,
          enterPriceMainCurrency: batch.buyingprice / item.exchangeRate,
          stockId: item.stock?._id,
          buyingPrice: item.orginalBuyingPrice,
          exchangeRate: item.exchangeRate,
          movementDate: cancellationDate,
          session,
        });
      }
    }
  }
};
const SALES_CUSTOMER_REVERSAL_MODES = {
  CANCEL: "cancel",
  REVERSE_UPDATE: "reverse_update",
};

exports.reverseSalesCustomerEffectsService = async ({
  customer,
  salesInvoice,
  companyId,
  currency,
  session,
  cancellationDate,
  mode = SALES_CUSTOMER_REVERSAL_MODES.CANCEL,
}) => {
  if (!customer) {
    throw new ApiError("Customer not found", 404);
  }

  const reversalConfig = {
    [SALES_CUSTOMER_REVERSAL_MODES.CANCEL]: {
      historyType: "invoice_cancel",
      sourceLabel: "Sales invoice cancellation",
      actionType: "cancel",
    },
    [SALES_CUSTOMER_REVERSAL_MODES.REVERSE_UPDATE]: {
      historyType: "invoice_reverse_update",
      sourceLabel: "Sales invoice reveres update",
      actionType: "update",
    },
  };

  const currentMode = reversalConfig[mode];

  if (!currentMode) {
    throw new ApiError(`Invalid customer reversal mode: ${mode}`, 400);
  }

  const totalMain = Number(salesInvoice.totalInMainCurrency || 0);
  const remainderMain = Number(salesInvoice.totalRemainderMainCurrency || 0);

  customer.total = Number(customer.total || 0) - totalMain;

  if (salesInvoice.paymentsStatus === "unpaid") {
    customer.TotalUnpaid = Number(customer.TotalUnpaid || 0) - totalMain;
  }

  if (salesInvoice.paymentsStatus === "paid") {
    customer.TotalUnpaid = Number(customer.TotalUnpaid || 0) - remainderMain;
  }

  if (customer.total < 0) customer.total = 0;
  // if (customer.TotalUnpaid < 0) customer.TotalUnpaid = 0;

  await customer.save({ session });

  await createPaymentHistoryV2({
    companyId,
    entryType: "invoice",
    transactionDate: cancellationDate,
    amountTransactionCurrency: salesInvoice.invoiceGrandTotal,
    amountMainCurrency: totalMain,
    customerId: customer._id,
    referenceId: salesInvoice._id,
    sourceModule: "sales",
    actionType: currentMode.actionType,
    description: currentMode.sourceLabel,
    balanceEffectType: "Withdrawal",
    transactionCurrency: currency?.currencyCode,
    session,
  });
};

exports.reverseSalesJournalEffectsService = async ({
  companyId,
  salesInvoice,
  session,
  counterFormat,
  cancellationDate,
  reversalJournalLinkCounter,
  mode = "cancel",
}) => {
  if (!salesInvoice?.journalCounter) {
    throw new ApiError(
      "journal link reference is missing on sales invoice",
      400,
    );
  }

  const modeConfig = {
    cancel: {
      journalType: "Sales Reversal",
      journalNamePrefix: "Sales Invoice Cancellation",
      journalDescPrefix:
        "Journal entry created to reverse the accounting effect of the cancelled sales invoice",
      originalStatus: "reversed",
    },
    reverse_update: {
      journalType: "Sales Reverse Update",
      journalNamePrefix: "Sales Invoice Update Reversal",
      journalDescPrefix:
        "Journal entry created to reverse the previous accounting effect before reposting the updated sales invoice",
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
      linkCounter: salesInvoice.journalCounter,
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
      originalJournal?.journalName || purchaseInvoice?.invoiceName || ""
    }`,
    journalDate: cancellationDate.split("T")[0],
    journalDesc: `${currentMode.journalDescPrefix} ${
      salesInvoice?.invoiceName || ""
    }`,
    journalType: currentMode.journalType,
    linkCounter: String(reversalJournalLinkCounter),
    refCounter: String(salesInvoice?.counter || ""),
    counter: counterFormat,
    refId: salesInvoice?._id,
    party: originalJournal?.party || salesInvoice?.customer?.id || "",
    receiptNumber:
      originalJournal?.receiptNumber || salesInvoice?.invoiceNumber || "",
    filesArray: [],
    journalDebit: totalDebit,
    journalCredit: totalCredit,
  };

  const createdReversalJournal = await createJournalServiceV2({
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

exports.upsertSalesInvoiceRecordService = async ({
  mode = "create",
  req,
  existingInvoice = null,
  invoiceDraft,
  customer,
  invoicesItem,
  customerObject,
  currency,
  taxDetails,
  tag,
  formattedDate,
  companyId,
  nextCounterPayment,
  draftJournalSnapshot,
  nextCounterSalesInvoices,
  session,
}) => {
  const {
    paymentsStatus,
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

  // if (paymentsStatus === "paid" && !invoiceDraft) {
  //   financialFund = await financialFundsModel
  //     .findOne({ _id: parsedFinancialFund?.id, companyId })
  //     .session(session);

  //   if (!financialFund) {
  //     throw new ApiError("Financial fund not found", 404);
  //   }

  //   financialFund.fundBalance += Number(paymentInFundCurrency || 0);
  // }

  const invoicePayload = {
    employee: { id: req.user._id, name: req.user.name },
    invoicesItems: invoicesItem,
    customer: customerObject,
    currency,
    exchangeRate,
    invoiceNumber,

    paymentsStatus: invoiceDraft ? "unpaid" : paymentsStatus,
    totalInMainCurrency: totalInMainCurrency,

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

    type: "sales",
    status: invoiceDraft ? "draft" : "posted",
    isDraft: invoiceDraft,
  };

  if (mode === "create" && !invoiceDraft) {
    invoicePayload.counter =
      Number(req.body.counter || 0) + nextCounterSalesInvoices.seq;

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

  if (paymentsStatus === "paid" && !invoiceDraft) {
    // invoicePayload.financailFund = parsedFinancialFund;
    invoicePayload.paymentInFundCurrency = paymentInFundCurrency;
  }

  if (paymentsStatus === "unpaid") {
    invoicePayload.dueDate = paymentDate;
  }

  let invoiceDoc;

  if (mode === "create") {
    const createdInvoice = await SalesInvoicesModel.create([invoicePayload], {
      session,
    });
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

  // if (paymentsStatus === "paid" && !invoiceDraft) {
  //   const payment = await paymentModel.create(
  //     [
  //       {
  //         source: {
  //           id: customerObject.id,
  //           name: customerObject.name,
  //         },
  //         destination: {
  //           id: financialFund._id,
  //           name: financialFund.fundName,
  //         },

  //         sourceType: "customer",
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

  //         type: "sales",
  //         paymentType: "Deposit",

  //         description: req.body.paymentDescription,
  //         date: req.body.paymentDate || formattedDate,

  //         counter: Number(req.body.counter || 0) + nextCounterPayment.seq,
  //         companyId,

  //         payid: [
  //           {
  //             id: invoiceDoc._id,
  //             status: req.body.paymentsStatus,
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
  //     customerId: customerObject.id,
  //     referenceId: invoiceDoc._id,
  //     sourceModule: "sales",
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
  //         type: "sales",
  //         exchangeRate,
  //         financialFundId: parsedFinancialFund?.id,

  //         financialFundRest: financialFund.fundBalance,

  //         paymentType: "Deposit",
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

exports.findAllSalesInvoicesService = async ({ req, companyId }) => {
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
    query["customer.name"] = {
      $regex: filters.businessPartners,
      $options: "i",
    };
  }

  if (req.query.keyword) {
    query.$or = [
      { "customer.name": { $regex: req.query.keyword, $options: "i" } },
      { invoiceName: { $regex: req.query.keyword, $options: "i" } },
      { invoiceNumber: { $regex: req.query.keyword, $options: "i" } },
    ];
  }

  if (filters?.filterTags?.length) {
    query["tag.name"] = { $in: filters.filterTags };
  }

  const totalItems = await orderModel.countDocuments(query);

  const totalPages = Math.ceil(totalItems / pageSize);
  const salesInvoices = await orderModel
    .find(query)
    .sort({ orderDate: -1 })
    .skip(skip)
    .limit(pageSize);

  return {
    totalItems,
    totalPages,
    salesInvoices,
  };
};

exports.findOneSalesInvoiceService = async ({ req, companyId }) => {
  const { id } = req.params;

  const salesInvoice = await orderModel
    .findOne({
      _id: id,
      companyId,
    })
    .populate({
      path: "employee",
      select: "name profileImg email phone",
    })
    .lean();

  if (!salesInvoice) {
    throw new ApiError(`No sales invoice for this id ${id}`, 404);
  }

  // ── PAYMENT COUNTERS ─────────────────────────────
  const paymentIds = salesInvoice?.payments?.map((p) => p.paymentID) || [];

  const paymentTransactions = await paymentModel
    .find({
      _id: { $in: paymentIds },
    })
    .select("counter")
    .lean();

  const paymentCounterMap = {};

  paymentTransactions.forEach((p) => {
    paymentCounterMap[p._id.toString()] = p.counter;
  });

  salesInvoice.payments = (salesInvoice.payments || []).map((payment) => ({
    ...payment,
    paymentCounter: paymentCounterMap[payment.paymentID?.toString()] || null,
  }));

  // ── HISTORY ─────────────────────────────
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
    salesInvoice,
    invoiceHistory,
  };
};

exports.findCustomerSalesInvoicesService = async ({ req, companyId }) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError("id is required", 400);
  }

  const pageSize = Number(req.query.limit) || 20;
  const page = Number(req.query.page) || 1;
  const skip = (page - 1) * pageSize;

  const query = {
    companyId,
    "customer.id": id,
    status: "posted",
    paymentsStatus: "unpaid",
    invoiceType: "sales",
  };

  const totalItems = await orderModel.countDocuments(query);
  const totalPages = Math.ceil(totalItems / pageSize);

  const salesInvoices = await orderModel
    .find(query)
    .sort({ date: -1, createdAt: -1 })
    .skip(skip)
    .limit(pageSize);

  return {
    totalItems,
    totalPages,
    salesInvoices,
  };
};
