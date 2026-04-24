const customarModel = require("../../../models/customarModel");
const financialFundsModel = require("../../../models/Accounting/CurrentAssets/financialFundsModel");
const invoiceHistoryModel = require("../../../models/invoiceHistoryModel");
const paymentModel = require("../../../models/paymentModel");
const productModel = require("../../../models/productModel");
const reportsFinancialFunds = require("../../../models/Accounting/CurrentAssets/reportsFinancialFunds");
const returnOrderModel = require("../../../models/returnOrderModel");
const batchLedgerModel = require("../../../models/Stocks/products/batchLedgerModel");
const prodcutBatchModel = require("../../../models/Stocks/products/prodcutBatchModel");
const ApiError = require("../../../utils/apiError");
const { createProductMovement } = require("../../../utils/productMovement");
const { createInvoiceHistory } = require("../../invoiceHistoryService");
const { createPaymentHistoryV2 } = require("../../paymentHistoryService");

exports.findAllSalesRefundsService = async ({ req, companyId }) => {
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

  const totalItems = await returnOrderModel.countDocuments(query);

  const totalPages = Math.ceil(totalItems / pageSize);
  const salesRefunds = await returnOrderModel
    .find(query)
    .sort({ orderDate: -1 })
    .skip(skip)
    .limit(pageSize);

  return {
    totalItems,
    totalPages,
    salesRefunds,
  };
};

exports.findOneSalesRefundService = async ({ req, companyId }) => {
  const { id } = req.params;

  const salesRefunds = await returnOrderModel.findOne({
    _id: id,
    companyId,
  });

  if (!salesRefunds) {
    throw new ApiError(`No refund sales invoice for this id ${id}`, 404);
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
    salesRefunds,
    invoiceHistory,
  };
};

exports.prepareRefundSalesInvoiceDataService = async ({
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

  // Parse JSON fields
  const customerObject = req.body.customer
    ? JSON.parse(req.body.customer)
    : req.body.customer;

  const taxSummary = req.body.taxDetails ? JSON.parse(req.body.taxDetails) : "";

  const invoicesItem = req.body.invoicesItem
    ? JSON.parse(req.body.invoicesItem)
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

  //   const draftJournalSnapshot = req.body.draftJournalSnapshot
  //     ? typeof req.body.draftJournalSnapshot === "string"
  //       ? JSON.parse(req.body.draftJournalSnapshot)
  //       : req.body.draftJournalSnapshot
  //     : null;

  return {
    customer,
    invoicesItem,
    customerObject,
    taxSummary,
    currency,
    tag,
    formattedDate,
    productMap,
    // draftJournalSnapshot,
  };
};

exports.createRefundSalesInvoiceRecordService = async ({
  req,
  customer,
  invoicesItem,
  customerObject,
  currency,
  taxSummary,
  tag,
  formattedDate,
  companyId,
  nextCounterPayment,
  //   draftJournalSnapshot,
  nextCounterRefundSalesInvoices,
  session,
  id,
  salesInvoice,
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

  if (req.body.financailFund) {
    parsedFinancialFund =
      typeof req.body.financailFund === "string"
        ? JSON.parse(req.body.financailFund)
        : req.body.financailFund;
  }

  let resolvedPaidStatus = paymentsStatus;

  if (paymentsStatus === "paid") {
    const paidAmountMain = Number(req.body.paymentInMainCurrency || 0);
    const invoiceTotalMain = Number(totalInMainCurrency || 0);

    const actualPaidMain = Math.min(paidAmountMain, invoiceTotalMain);
    const isFullyPaid = actualPaidMain >= invoiceTotalMain - 0.000001;
    resolvedPaidStatus = isFullyPaid ? "paid" : "unpaid";
    financialFund = await financialFundsModel
      .findOne({ _id: parsedFinancialFund?.id, companyId })
      .session(session);

    if (!financialFund) {
      throw new ApiError("Financial fund not found", 404);
    }

    financialFund.fundBalance += Number(paymentInFundCurrency || 0);
  }

  const invoicePayload = {
    employee: req.user._id,
    invoicesItems: invoicesItem,
    customer: customerObject,
    currency,
    exchangeRate,
    invoiceNumber,
    paymentsStatus: resolvedPaidStatus,
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
  };
  invoicePayload.counter =
    Number(req.body.counter || 0) + nextCounterRefundSalesInvoices.seq;

  if (paymentsStatus === "paid") {
    invoicePayload.financailFund = parsedFinancialFund;
    invoicePayload.paymentInFundCurrency = paymentInFundCurrency;
  }

  if (paymentsStatus === "unpaid") {
    invoicePayload.dueDate = paymentDate;
  }
  const createdInvoice = await returnOrderModel.create([invoicePayload], {
    session,
  });

  const newRefundSalesInvoice = createdInvoice[0];

  if (paymentsStatus === "paid") {
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
          type: "refund sales",
          paymentType: "Deposit",
          description: req.body.paymentDescription,
          date: req.body.paymentDate || formattedDate,
          counter: Number(req.body.counter || 0) + nextCounterPayment.seq,
          companyId,
          payid: [
            {
              id: newRefundSalesInvoice._id,
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

    await createPaymentHistoryV2({
      companyId,
      entryType: "payment",
      transactionDate: req.body.paymentDate || formattedDate,
      amountTransactionCurrency: paymentInFundCurrency,
      amountMainCurrency:
        paymentInFundCurrency /
        (newRefundSalesInvoice.financailFund[0]?.exchangeRate || 1),
      customerId: customerObject.id,
      referenceId: newRefundSalesInvoice._id,
      sourceModule: "sales",
      actionType: "create",
      balanceEffectType: "Deposit",
      description: req.body.description,
      transactionCurrency: newRefundSalesInvoice.financailFund[0]?.currency,
      session,
    });
    const reports = await reportsFinancialFunds.create(
      [
        {
          date: req.body.paymentDate || formattedDate,
          ref: newRefundSalesInvoice._id,
          amount: paymentInFundCurrency,
          type: "sales",
          exchangeRate,
          financialFundId: parsedFinancialFund?.id,
          financialFundRest: financialFund.fundBalance,
          paymentType: "Deposit",
          payment: payment[0]._id,
          description: req.body.paymentDescription,
          companyId,
        },
      ],
      { session }
    );

    newRefundSalesInvoice.payments.push({
      payment: paymentInFundCurrency,
      paymentMainCurrency: req.body.paymentInMainCurrency,
      financialFunds: financialFund.fundName,
      financialFundsCurrencyCode: parsedFinancialFund?.code,
      date: req.body.paymentDate || formattedDate,
      paymentID: payment[0]._id,
      paymentInInvoiceCurrency: req.body.paymentInInvoiceCurrency,
      financialFundsId: parsedFinancialFund?.id,
    });

    newRefundSalesInvoice.reportsBalanceId = reports[0]._id;

    await createInvoiceHistory(
      companyId,
      newRefundSalesInvoice._id,
      "create",
      req.user._id,
      req.body.date || formattedDate,
      "Refund Sales invoice created",
      "Sales",
      session
    );

    if (paymentsStatus === "paid") {
      await createInvoiceHistory(
        companyId,
        newRefundSalesInvoice._id,
        "payment",
        req.user._id,
        req.body.paymentDate || formattedDate,
        "Invoice payment recorded",
        "sales",
        session
      );
    }
  }
  return newRefundSalesInvoice;
};

exports.applySalesReturnCartItemEditService = async ({
  salesInvoice,
  invoicesItem,
  session,
}) => {
  for (const updatedItem of invoicesItem) {
    const index = salesInvoice.returnCartItem.findIndex((item) =>
      updatedItem.type !== "unTracedproduct"
        ? item.qr === updatedItem.qr
        : item.name === updatedItem.name
    );

    if (index === -1) continue;

    const oldItem = salesInvoice.returnCartItem[index];

    const newQty =
      Number(oldItem.soldQuantity || 0) - Number(updatedItem.soldQuantity || 0);

    const newTotal =
      Number(oldItem.total || 0) - Number(updatedItem.total || 0);

    const newTotalWithoutTax =
      Number(oldItem.totalWithoutTax || 0) -
      Number(updatedItem.totalWithoutTax || 0);

    salesInvoice.returnCartItem[index].soldQuantity = newQty >= 0 ? newQty : 0;

    salesInvoice.returnCartItem[index].total = newTotal >= 0 ? newTotal : 0;

    salesInvoice.returnCartItem[index].totalWithoutTax =
      newTotalWithoutTax >= 0 ? newTotalWithoutTax : 0;
  }

  await salesInvoice.save({ session });
};

exports.applyRefundSalesInventoryEffectsService = async ({
  invoicesItem,
  productMap,
  newRefundSalesInvoice,
  companyId,
  date,
  session,
}) => {
  const resolveItemCost = (item) =>
    Number(
      item?.draftCostBuyingPrice ??
        item?.oldCostBuyingPrice ??
        item?.orginalBuyingPrice ??
        0
    );

  let currentStockQty = 0;

  const bulkProductUpdates = [];

  for (const item of invoicesItem) {
    if (item.type === "unTracedproduct" || item.type === "expense") continue;

    const product = productMap.get(item.id);

    if (!product) {
      throw new ApiError(`Product not found for item ${item.name}`, 404);
    }

    if (!item.stock?._id) {
      throw new ApiError(`Stock is missing for item ${item.name}`, 400);
    }

    const stockRow = (product.stocks || []).find(
      (s) => String(s.stockId) === String(item.stock._id)
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
    if (item.type === "unTracedproduct" || item.type === "expense") continue;

    for (const batchItem of item.batches) {
      const batch = await prodcutBatchModel
        .findById(batchItem.id)
        .session(session);

      if (!batch) {
        throw new ApiError(`Batch not found ${batchItem.id}`, 404);
      }

      const qtyToRestore = Number(batchItem.quantity || 0);

      batch.remaining += Number(item.soldQuantity || 0);

      batch.status = "active";

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
            referenceId: newRefundSalesInvoice._id,
            movementDate: date,
            actionType: "create",
          },
        ],
        { session }
      );

      await batch.save({ session });
    }

    const movementCost = resolveItemCost(item);

    await createProductMovement({
      productId: item.id,
      reference: newRefundSalesInvoice._id,
      newQuantity: currentStockQty + item.soldQuantity,
      quantity: item.soldQuantity,
      movementType: "in",
      source: "Refund Sales Invoice",
      companyId,
      enterPrice: movementCost,
      stockId: item.stock?._id,
      buyingPrice: item.orginalBuyingPrice,
      exchangeRate: item.exchangeRate,
      movementDate: new Date(),
      session,
    });
  }
};

exports.applyRefundSalesCustomerEffectsService = async ({
  customer,
  newRefundSalesInvoice,
  companyId,
  currency,
  session,
}) => {
  if (!customer) {
    throw new ApiError("Customer not found", 404);
  }

  const totalMain = Number(newRefundSalesInvoice.totalInMainCurrency || 0);
  const remainderMain = Number(
    newRefundSalesInvoice.totalRemainderMainCurrency || 0
  );

  customer.total = Number(customer.total || 0) - totalMain;

  if (newRefundSalesInvoice.paymentsStatus === "unpaid") {
    customer.TotalUnpaid = Number(customer.TotalUnpaid || 0) - totalMain;
  }

  if (newRefundSalesInvoice.paymentsStatus === "paid") {
    customer.TotalUnpaid = Number(customer.TotalUnpaid || 0) - remainderMain;
  }

  await customer.save({ session });

  await createPaymentHistoryV2({
    companyId,
    entryType: "invoice",
    transactionDate: newRefundSalesInvoice.date,
    amountTransactionCurrency: Number(
      newRefundSalesInvoice.invoiceGrandTotal || 0
    ),
    amountMainCurrency: totalMain,
    customerId: customer._id,
    referenceId: newRefundSalesInvoice._id,
    sourceModule: "sales",
    actionType: "refund",
    description: "Refund sales invoice",
    transactionCurrency: currency?.currencyCode || "",
    session,
  });
};
