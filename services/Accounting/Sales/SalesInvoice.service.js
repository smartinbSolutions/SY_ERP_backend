const customarModel = require("../../../models/customarModel");
const financialFundsModel = require("../../../models/financialFundsModel");
const orderModel = require("../../../models/orderModel");
const paymentModel = require("../../../models/paymentModel");
const prodcutBatchModel = require("../../../models/prodcutBatchModel");
const productModel = require("../../../models/productModel");
const reportsFinancialFunds = require("../../../models/reportsFinancialFunds");
const ApiError = require("../../../utils/apiError");
const { createProductMovement } = require("../../../utils/productMovement");
const { createInvoiceHistory } = require("../../invoiceHistoryService");
const { createJournalService } = require("../../journalEntryServices");
const { createPaymentHistory } = require("../../paymentHistoryService");

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
  const taxDetails = salesInvoice.taxDetails || [];
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
    taxDetails,
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

  if (paid === "paid" && !invoiceDraft) {
    financialFund = await financialFundsModel
      .findOne({ _id: parsedFinancialFund?.id, companyId })
      .session(session);

    if (!financialFund) {
      throw new ApiError("Financial fund not found", 404);
    }

    financialFund.fundBalance -= Number(paymentInFundCurrency || 0);
  }
  const invoicePayload = {
    employee: { id: req.user._id, name: req.user.name },
    invoicesItems: invoicesItem,
    customer: customerObject,
    currency,
    exchangeRate,
    invoiceNumber,
    paid: invoiceDraft ? "unpaid" : paid,
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
    totalRemainder,
    totalRemainderMainCurrency,
    status: "draft",
    isDraft: invoiceDraft,
    postedBy: invoiceDraft ? null : req.user._id,
    postedAt: invoiceDraft ? null : new Date(),
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

  if (paid === "paid" && !invoiceDraft) {
    invoicePayload.financailFund = parsedFinancialFund;
    invoicePayload.paymentInFundCurrency = paymentInFundCurrency;
  }

  if (paid === "unpaid") {
    invoicePayload.dueDate = paymentDate;
  }

  const createdInvoice = await orderModel.create([invoicePayload], {
    session,
  });

  const newSalesInvoice = createdInvoice[0];

  if (paid === "paid" && !invoiceDraft) {
    const payment = await paymentModel.create(
      [
        {
          source: {
            id: financialFund._id,
            name: financialFund.fundName,
          },
          destination: {
            id: customerObject.id,
            name: customerObject.name,
          },
          sourceType: "sales",
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
          type: "sales",
          paymentType: "Withdrawal",
          description: req.body.paymentDescription,
          date: req.body.paymentDate || formattedDate,
          counter: Number(req.body.counter || 0) + nextCounterPayment.seq,
          companyId,
          payid: [
            {
              id: newSalesInvoice._id,
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

    await createPaymentHistory(
      "payment",
      req.body.paymentDate || formattedDate,
      req.body.paymentInMainCurrency,
      paymentInFundCurrency,
      "supplier",
      customerObject.id,
      newSalesInvoice._id,
      companyId,
      req.body.paymentDescription,
      payment[0]._id,
      "Deposit",
      "sales",
      parsedFinancialFund?.code,
      session,
    );
    const reports = await reportsFinancialFunds.create(
      [
        {
          date: req.body.paymentDate || formattedDate,
          ref: newSalesInvoice._id,
          amount: paymentInFundCurrency,
          type: "sales",
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

    newSalesInvoice.payments.push({
      payment: paymentInFundCurrency,
      paymentMainCurrency: req.body.paymentInMainCurrency,
      financialFunds: financialFund.fundName,
      financialFundsCurrencyCode: parsedFinancialFund?.code,
      date: req.body.paymentDate || formattedDate,
      paymentID: payment[0]._id,
      paymentInInvoiceCurrency: req.body.paymentInInvoiceCurrency,
      financialFundsId: parsedFinancialFund?.id,
    });

    newSalesInvoice.reportsBalanceId = reports[0]._id;

    await newSalesInvoice.save({ session });
    await financialFund.save({ session });
  }

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

  if (paid === "paid" && !invoiceDraft) {
    await createInvoiceHistory(
      companyId,
      newSalesInvoice._id,
      "payment",
      req.user._id,
      req.body.paymentDate || formattedDate,
      "Invoice payment recorded",
      "sales",
      session,
    );
  }

  return newSalesInvoice;
};

exports.applySalesInventoryEffectsService = async ({
  invoicesItem,
  productMap,
  newSalesInvoice,
  companyId,
  date,
  session,
}) => {
  const bulkOperations = [];

  for (const item of invoicesItem) {
    if (
      item.type === "unTracedproduct" ||
      item.type === "expense" ||
      item.type === "Service"
    )
      continue;

    const product = productMap.get(item.id);
    if (!product || !item.stock?._id) continue;

    const soldQty = Number(item.quantity || item.soldQuantity || 0);

    const oldQty =
      (product.stocks || []).find((s) => s._id === item.stock._id)
        ?.productQuantity || 0;

    if (soldQty > oldQty) {
      throw new ApiError(
        `Insufficient stock for product ${product.name} in warehouse ${item.stock.stock}. Requested: ${soldQty}, Available: ${oldQty}. Please adjust the quantity or select another warehouse.`,
        400,
      );
    }

    let qtyToSell = soldQty;
    const fifoMovements = [];

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

      const usedQty = Math.min(batch.remaining, qtyToSell);

      batch.remaining -= usedQty;
      await batch.save({ session });

      qtyToSell -= usedQty;

      fifoMovements.push({
        quantity: usedQty,
        costBuyingPrice: batch.costBuyingPrice,
        batchId: batch._id,
      });
    }

    if (qtyToSell > 0) {
      throw new ApiError(
        `Insufficient stock for product "${product.name}". Requested: ${qtyToSell}, Available: ${oldQty}.`,
        400,
      );
    }

    let soldTotalCost = 0;

    for (const fm of fifoMovements) {
      soldTotalCost += fm.quantity * fm.costBuyingPrice;

      await createProductMovement({
        productId: product._id,
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

  if (bulkOperations.length > 0) {
    await productModel.bulkWrite(bulkOperations, { session });
  }
};

exports.applySalesCustomerEffectsService = async ({
  invoicesItem,
  customer,
  newSalesInvoice,
  companyId,
  currency,
  date,
  totalInMainCurrency,
  totalRemainderMainCurrency,
  paid,
  session,
}) => {
  if (!customer) {
    throw new ApiError("Customer not found", 404);
  }

  const totalMain = Number(totalInMainCurrency || 0);
  const remainderMain = Number(totalRemainderMainCurrency || 0);

  customer.total += totalMain;

  if (paid === "unpaid") {
    customer.TotalUnpaid += totalMain;
  }

  if (paid === "paid") {
    customer.TotalUnpaid += remainderMain;
  }

  await customer.save({ session });

  await createPaymentHistory(
    "invoice",
    date,
    totalMain,
    newSalesInvoice.invoiceGrandTotal,
    "customer",
    customer._id,
    newSalesInvoice._id,
    companyId,
    "",
    "",
    "",
    "",
    currency.currencyCode,
    session,
  );
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

  const journalPayload = {
    ...journalMeta,
    linkCounter: String(journalLinkCounter),
    refCounter: String(invoiceRefCounter || ""),
    counter: counterFormat,
    refId: salesInvoice?._id,
    party: journalMeta?.party || salesInvoice?.customer?.id || "",
    journalType: journalMeta?.journalType || "Sales",
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
