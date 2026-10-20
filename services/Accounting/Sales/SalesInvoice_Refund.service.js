const customarModel = require("../../../models/Accounting/Sales/customarModel");
const financialFundsModel = require("../../../models/Accounting/CurrentAssets/financialFundsModel");
const invoiceHistoryModel = require("../../../models/invoiceHistoryModel");
const paymentModel = require("../../../models/paymentModel");
const productModel = require("../../../models/Stocks/products/productModel");
const reportsFinancialFunds = require("../../../models/Accounting/CurrentAssets/reportsFinancialFunds");
const returnOrderModel = require("../../../models/Accounting/Sales/refund_sales.model");
const batchLedgerModel = require("../../../models/Stocks/products/batchLedgerModel");
const prodcutBatchModel = require("../../../models/Stocks/products/prodcutBatchModel");
const ApiError = require("../../../utils/apiError");
const { createProductMovement } = require("../../../utils/productMovement");
const { createInvoiceHistory } = require("../../invoiceHistoryService");
const { createPaymentHistoryV2 } = require("../../paymentHistoryService");
const unTracedproductLogModel = require("../../../models/Stocks/products/unTracedproductLogModel");
const { buildCounter } = require("../../../utils/buildCounter");

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

  const salesRefunds = await returnOrderModel
    .findOne({
      _id: id,
      companyId,
    })
    .populate({ path: "employee", select: "name email" });

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
    .populate({ path: "employee", select: "name email" })
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
  invoicesItem,
  customerObject,
  currency,
  taxSummary,
  tag,
  companyId,
  //   draftJournalSnapshot,
  nextCounterRefundSalesInvoices,
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
    updateDate,
  } = req.body;

  const invoiceTotalMain = Number(totalInMainCurrency || 0);
  const invoiceTotalInvoice = Number(invoiceGrandTotal || 0);

  const resolvedPaidStatus = "unpaid";
  const resolvedRemainderMain = invoiceTotalMain;
  const resolvedRemainder = invoiceTotalInvoice;

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
    orderDate: req.body.date || updateDate,
    journalCounter,
    description,
    file: req.body.file,
    paymentDate,
    totalRemainder: resolvedRemainder,
    totalRemainderMainCurrency: resolvedRemainderMain,
  };

  invoicePayload.counter = buildCounter({
    base: req.body.counter,
    seq: nextCounterRefundSalesInvoices.seq,
    digits: req.counterDigits,
  });

  if (paymentsStatus === "paid") {
    // invoicePayload.financailFund = parsedFinancialFund;
    invoicePayload.paymentInFundCurrency = paymentInFundCurrency;
  }

  if (paymentsStatus === "unpaid") {
    invoicePayload.dueDate = paymentDate;
  }
  const createdInvoice = await returnOrderModel.create([invoicePayload], {
    session,
  });

  const newRefundSalesInvoice = createdInvoice[0];

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
        : item.name === updatedItem.name,
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
        0,
    );

  let currentStockQty = 0;

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
            enterPriceMainCurrency:
              item.sellingPrice / newRefundSalesInvoice.currency.exchangeRate,
            totalWithoutTax: item.totalWithoutTax,
            total: item.total,
            tax: { _id: item.tax, taxValue: item.taxValue },
            sourceModule: "Refund Sales Invoice",
            reference: newRefundSalesInvoice._id,
            referenceModel: "refundSales",
            companyId,
            date: newRefundSalesInvoice.orderDate,
          },
        ],
        { session },
      );
    } else if (item.type === "Service") {
      await createProductMovement({
        productId: item.id,
        reference: newRefundSalesInvoice._id,
        newQuantity: 0,
        quantity: item.soldQuantity,
        movementType: "in",
        source: "Refund Sales Invoice",
        companyId,
        enterPrice: item.orginalBuyingPrice,
        stockId: item.stock?._id,
        buyingPrice: item.orginalBuyingPrice,
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
        { session },
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
    newRefundSalesInvoice.totalRemainderMainCurrency || 0,
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
    transactionDate:
      newRefundSalesInvoice.paymentDate || newRefundSalesInvoice.orderDate,
    amountTransactionCurrency: Number(
      newRefundSalesInvoice.invoiceGrandTotal || 0,
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
