const purchaseinvoicesModel = require("../../../models/Accounting/Purchase/purchaseinvoicesModel");
const refundPurchaseInviceModel = require("../../../models/Accounting/Purchase/refundPurchaseInviceModel");
const invoiceHistoryModel = require("../../../models/invoiceHistoryModel");
const ProductBatchModel = require("../../../models/Stocks/products/prodcutBatchModel");
const ApiError = require("../../../utils/apiError");
const multer = require("multer");
const productModel = require("../../../models/Stocks/products/productModel");
const financialFundsModel = require("../../../models/Accounting/CurrentAssets/financialFundsModel");
const paymentModel = require("../../../models/paymentModel");
const reportsFinancialFunds = require("../../../models/Accounting/CurrentAssets/reportsFinancialFunds");
const suppliersModel = require("../../../models/Accounting/Purchase/suppliersModel");
const batchLedgerModel = require("../../../models/Stocks/products/batchLedgerModel");
const { createProductMovement } = require("../../../utils/productMovement");
const { createPaymentHistoryV2 } = require("../../paymentHistoryService");
const paymentsModel = require("../../../models/Accounting/CurrentAssets/payments.model");
const unTracedproductLogModel = require("../../../models/Stocks/products/unTracedproductLogModel");

function padZero(value) {
  return value < 10 ? `0${value}` : value;
}
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
        new ApiError("Invalid file type. Only images and PDFs are allowed."),
      );
    }
  },
});

exports.uploadFile = upload.single("file");

exports.findAllPurchaseRefundsService = async ({ req, companyId }) => {
  const pageSize = Number(req.query.limit) || 20;
  const page = parseInt(req.query.page, 10) || 1;
  const skip = (page - 1) * pageSize;
  const filters = req.query?.filters ? JSON.parse(req.query.filters) : {};

  const query = { companyId };

  if (req.query.keyword) {
    query.$or = [
      {
        "supllier.name": { $regex: req.query.keyword, $options: "i" },
      },
      {
        invoiceName: { $regex: req.query.keyword, $options: "i" },
      },
      {
        invoiceNumber: { $regex: req.query.keyword, $options: "i" },
      },
    ];
  }

  if (filters?.startDate || filters?.endDate) {
    query.date = {};
    if (filters?.startDate) {
      query.date.$gte = filters.startDate;
    }
    if (filters?.endDate) {
      query.date.$lte = filters.endDate;
    }
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

  if (filters?.filterTags?.length) {
    query["tag.name"] = { $in: filters.filterTags };
  }

  const totalItems = await refundPurchaseInviceModel.countDocuments(query);
  const totalPages = Math.ceil(totalItems / pageSize);

  const purchaseRefunds = await refundPurchaseInviceModel
    .find(query)
    .skip(skip)
    .limit(pageSize)
    .sort({ date: -1 })
    .populate({
      path: "employee",
      select: "name profileImg email phone",
    });

  return {
    totalItems,
    totalPages,
    purchaseRefunds,
  };
};

exports.findOnePurchaseRefundService = async ({ req, companyId }) => {
  const { id } = req.params;

  const purchaseRefund = await refundPurchaseInviceModel
    .findOne({
      _id: id,
      companyId,
    })
    .populate({
      path: "employee",
      select: "name profileImg email phone",
    })
    .lean();

  if (!purchaseRefund) {
    throw new ApiError(`No purchase refund for this id ${id}`, 404);
  }

  // ── PAYMENT COUNTERS ─────────────────────────────
  const paymentIds = purchaseRefund?.payments?.map((p) => p.paymentID) || [];

  const paymentTransactions = await paymentsModel
    .find({
      _id: { $in: paymentIds },
    })
    .select("counter")
    .lean();

  const paymentCounterMap = {};

  paymentTransactions.forEach((p) => {
    paymentCounterMap[p._id.toString()] = p.counter;
  });

  purchaseRefund.payments = (purchaseRefund.payments || []).map((payment) => ({
    ...payment,
    paymentCounter: paymentCounterMap[payment.paymentID?.toString()] || null,
  }));

  // ── HISTORY ─────────────────────────────
  const pageSize = Number(req.query.limit) || 20;
  const page = Number(req.query.page) || 1;
  const skip = (page - 1) * pageSize;

  const totalItems = await invoiceHistoryModel.countDocuments({
    invoiceId: id,
    companyId,
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
    purchaseRefund,
    invoiceHistory,
  };
};

exports.findRefundablePurchaseItemsByInvoicesService = async ({
  req,
  companyId,
}) => {
  const { invoiceIds } = req.body;

  if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
    throw new ApiError(
      "invoiceIds is required and must be a non-empty array",
      400,
    );
  }

  const purchaseInvoices = await purchaseinvoicesModel
    .find({
      _id: { $in: invoiceIds },
      companyId,
      status: "posted",
    })
    .populate("invoicesItems.tax")
    .lean();

  if (!purchaseInvoices.length) {
    throw new ApiError(
      "No posted purchase invoices found for the provided ids",
      404,
    );
  }

  const refundableItems = [];

  for (const invoice of purchaseInvoices) {
    const invoiceItems = Array.isArray(invoice.invoicesItems)
      ? invoice.invoicesItems
      : [];

    for (let index = 0; index < invoiceItems.length; index++) {
      const item = invoiceItems[index];

      if (item.type === "expense" || item.type === "unTracedproduct") {
        continue;
      }

      const productId = item.id || null;

      let batches = [];
      if (productId) {
        batches = await ProductBatchModel.find({
          companyId,
          productId,
          status: "active",
          remaining: { $gt: 0 },
          $or: [
            {
              sourceType: "purchase",
              sourceId: invoice._id,
            },
            {
              originType: "purchase",
              originId: invoice._id,
            },
          ],
        }).lean();
      }

      refundableItems.push({
        sourceInvoiceId: invoice._id,
        sourceInvoiceNumber: invoice.invoiceNumber || "",
        sourceInvoiceName: invoice.invoiceName || "",
        sourceInvoiceDate: invoice.date || "",
        sourceInvoiceItemIndex: index,

        productId: item.id || "",
        productName: item.name || "",
        qr: item.qr || "",
        type: item.type,

        unit: item.unit || "",
        tax: item.tax || null,
        stock: item.stock || null,

        orginalBuyingPrice: Number(item.orginalBuyingPrice || 0),
        convertedBuyingPrice: Number(item.convertedBuyingPrice || 0),
        exchangeRate: Number(item.exchangeRate || invoice.exchangeRate || 1),

        purchasedQty: Number(item.quantity || 0),
        refundedQty: 0,
        remainingQty: Number(item.quantity || 0),

        note: item.note || "",

        batches: batches.map((batch) => ({
          batchId: batch._id,
          stockId: batch.stockId || null,
          batchDate: batch.batchDate || null,
          quantity: Number(batch.quantity || 0),
          remaining: Number(batch.remaining || 0),
          buyingprice: Number(batch.buyingprice || 0),
          costBuyingPrice: Number(batch.costBuyingPrice || 0),
          exchangeRate: Number(batch.exchangeRate || 1),
          status: batch.status || "",
          sourceId: batch.sourceId || null,
          sourceType: batch.sourceType || "",
          originId: batch.originId || null,
          originType: batch.originType || "",
          parentBatchId: batch.parentBatchId || null,
        })),
      });
    }
  }

  return {
    refundableItems,
    purchaseInvoicesCount: purchaseInvoices.length,
  };
};

exports.prepareRefundPurchaseInvoiceDataService = async ({
  req,
  companyId,
  session,
}) => {
  const ts = Date.now();

  const futureTs = ts + 5000;
  const futureDateOb = new Date(futureTs);
  const futureDateOb2 = new Date(ts);

  futureDateOb2.setSeconds(futureDateOb.getSeconds() + 1);

  const futureFormattedDate = `${padZero(futureDateOb2.getHours())}:${padZero(
    futureDateOb2.getMinutes(),
  )}:${padZero(futureDateOb2.getSeconds())}.${padZero(
    futureDateOb2.getMilliseconds(),
  )}`;

  const futureFormatDate = `${padZero(futureDateOb.getHours())}:${padZero(
    futureDateOb.getMinutes(),
  )}:${padZero(futureDateOb.getSeconds())}.${padZero(
    futureDateOb.getMilliseconds(),
  )}`;

  if (req.body.paymentDate) {
    req.body.paymentDate = `${req.body.paymentDate}T${futureFormattedDate}Z`;
  }

  if (req.body.date) {
    req.body.date = `${req.body.date}T${futureFormatDate}Z`;
  }

  const formattedDate = new Date().toISOString().replace("T", " ").slice(0, 19);

  const rawSupplierPayload =
    typeof req.body.supplier === "string"
      ? JSON.parse(req.body.supplier)
      : req.body.supplier || {};

  const rawInvoicesItems =
    typeof req.body.invoicesItems === "string"
      ? JSON.parse(req.body.invoicesItems)
      : req.body.invoicesItems || [];

  const rawSourcePurchaseInvoices =
    typeof req.body.sourcePurchaseInvoices === "string"
      ? JSON.parse(req.body.sourcePurchaseInvoices)
      : req.body.sourcePurchaseInvoices || [];

  const supplierPayload = {
    id: rawSupplierPayload.id || "",
    name: rawSupplierPayload.name || "",
    phone: rawSupplierPayload.phone || "",
    email: rawSupplierPayload.email || "",
    address: rawSupplierPayload.address || "",
    company: rawSupplierPayload.company || rawSupplierPayload.Company || "",
    taxAdministration: rawSupplierPayload.taxAdministration || "",
    taxNumber: rawSupplierPayload.taxNumber || "",
    country: rawSupplierPayload.country || "",
    city: rawSupplierPayload.city || "",
    linkAccount: rawSupplierPayload.linkAccount || "",
  };

  const invoicesItems = rawInvoicesItems.map((item) => ({
    id: item.id || "",
    type: item.type || "product",
    qr: item.qr || "",
    name: item.name || "",
    orginalBuyingPrice: Number(item.orginalBuyingPrice || 0),

    tax: item.tax
      ? {
          _id: item.tax._id || null,
          tax: Number(item.tax.tax || 0),
          name: item.tax.name || "",
        }
      : {
          _id: null,
          tax: 0,
          name: "",
        },

    stock: item.stock
      ? {
          _id: item.stock._id || null,
          stock: item.stock.stock || "",
        }
      : {
          _id: null,
          stock: "",
        },

    unit: item.unit || "",
    exchangeRate: Number(item.exchangeRate || 1),

    discountType: item.discountType || "percentage",
    discountPercentege: Number(item.discountPercentege || 0),
    discountAmount: Number(item.discountAmount || 0),
    discount: Number(item.discount || 0),

    convertedBuyingPrice: Number(item.convertedBuyingPrice || 0),
    totalWithoutTax: Number(item.totalWithoutTax || 0),
    total: Number(item.total || 0),
    taxValue: Number(item.taxValue || 0),
    profitRatio: Number(item.profitRatio || 0),

    sourceInvoiceId: item.sourceInvoiceId || null,
    sourceInvoiceNumber: item.sourceInvoiceNumber || "",
    sourceInvoiceName: item.sourceInvoiceName || "",
    sourceInvoiceDate: item.sourceInvoiceDate || "",
    sourceInvoiceItemIndex:
      item.sourceInvoiceItemIndex !== undefined &&
      item.sourceInvoiceItemIndex !== null
        ? Number(item.sourceInvoiceItemIndex)
        : null,

    refundedQuantity: Number(item.refundedQuantity || 0),
    remainingQuantityBeforeRefund: Number(
      item.remainingQuantityBeforeRefund || 0,
    ),
    remainingQuantityAfterRefund: Number(
      item.remainingQuantityAfterRefund || 0,
    ),

    selectedBatchId: item.selectedBatchId || null,
    selectedBatchStockId: item.selectedBatchStockId || null,
    selectedBatchDate: item.selectedBatchDate || null,
    selectedBatchRemainingAtRefund: Number(
      item.selectedBatchRemainingAtRefund || 0,
    ),
  }));

  const sourcePurchaseInvoices = rawSourcePurchaseInvoices.map((invoice) => ({
    invoiceId: invoice.invoiceId || null,
    invoiceNumber: invoice.invoiceNumber || "",
    invoiceName: invoice.invoiceName || "",
    invoiceDate: invoice.invoiceDate || "",
  }));

  const supplier = await suppliersModel
    .findOne({ _id: supplierPayload.id, companyId })
    .session(session);

  if (!supplier) {
    throw new ApiError("Supplier not found", 404);
  }

  const productIds = invoicesItems
    .filter(
      (item) =>
        item.type !== "unTracedproduct" &&
        item.type !== "expense" &&
        item.type !== "Service",
    )
    .map((item) => item.id);

  const products = await productModel
    .find({
      _id: { $in: productIds },
      companyId,
    })
    .session(session);

  const productMap = new Map(
    products.map((product) => [product._id.toString(), product]),
  );

  return {
    formattedDate,
    supplier,
    supplierPayload,
    invoicesItems,
    sourcePurchaseInvoices,
    productMap,
  };
};

exports.createRefundPurchaseInvoiceRecordService = async ({
  req,
  companyId,
  session,
  supplierPayload,
  invoicesItems,
  sourcePurchaseInvoices,
  formattedDate,
  nextCounterRefundPurchaseInvoice,
}) => {
  const {
    paid,
    financailFund,
    exchangeRate,
    totalInMainCurrency: totalPurchasePriceMainCurrency,
    currency,
    invoiceNumber,
    invoiceSubTotal,
    invoiceDiscount,
    invoiceGrandTotal,
    ManualInvoiceDiscount,
    taxDetails,
    invoiceName,
    paymentInFundCurrency,
    InvoiceDiscountType,
    subtotalWithDiscount,
    paymentDate,
    counter,
  } = req.body;

  // ─────────────────────────────────────────────
  // FORCE SAME BEHAVIOR AS PURCHASE INVOICE
  // DO NOT TRUST FRONTEND FOR REMAINDER
  // ─────────────────────────────────────────────

  const resolvedPaidStatus = paid === "paid" ? "paid" : "unpaid";

  const resolvedRemainderMain = Number(totalPurchasePriceMainCurrency || 0);
  const resolvedRemainder = Number(invoiceGrandTotal || 0);

  const createdInvoices = await refundPurchaseInviceModel.create(
    [
      {
        employee: req.user?._id,
        supplier: supplierPayload,
        type: "refund purchase",

        invoicesItems,
        sourcePurchaseInvoices,

        exchangeRate: Number(exchangeRate || 1),
        currency: currency || {},

        invoiceGrandTotal: Number(invoiceGrandTotal || 0),
        invoiceSubTotal: Number(invoiceSubTotal || 0),
        invoiceDiscount: Number(invoiceDiscount || 0),
        ManualInvoiceDiscount: Number(ManualInvoiceDiscount || 0),
        invoiceTax: Number(req.body.invoiceTax || 0),

        taxDetails: taxDetails || [],

        invoiceName: invoiceName || "",
        invoiceNumber: invoiceNumber || "",

        financailFund: financailFund || {},
        paymentInFundCurrency: paymentInFundCurrency || "",
        totalPurchasePriceMainCurrency: Number(
          totalPurchasePriceMainCurrency || 0,
        ),

        date: req.body.date || formattedDate,
        description: req.body.description || "",
        invoiceType: req.body.invoiceType || "",

        // ─────────────────────────────────────────────
        // IMPORTANT FIX (same as purchase invoice)
        // ─────────────────────────────────────────────
        totalRemainderMainCurrency: resolvedRemainderMain,
        totalRemainder: resolvedRemainder,

        tag: req.body.tag || [],
        InvoiceDiscountType: InvoiceDiscountType || "value",
        paid: resolvedPaidStatus,

        journalCounter: req.body.journalCounter,
        counter: Number(counter) + nextCounterRefundPurchaseInvoice.seq,
        companyId,
      },
    ],
    { session },
  );

  return createdInvoices[0];
};

exports.applyRefundPurchaseSupplierEffectsService = async ({
  supplier,
  newRefundPurchaseInvoice,
  companyId,
  currency,
  session,
}) => {
  if (!supplier) {
    throw new ApiError("Supplier not found", 404);
  }

  const totalMain = Number(
    newRefundPurchaseInvoice.totalPurchasePriceMainCurrency || 0,
  );
  const remainderMain = Number(
    newRefundPurchaseInvoice.totalRemainderMainCurrency || 0,
  );

  supplier.total = Number(supplier.total || 0) - totalMain;

  if (newRefundPurchaseInvoice.paid === "unpaid") {
    supplier.TotalUnpaid = Number(supplier.TotalUnpaid || 0) - totalMain;
  }

  if (newRefundPurchaseInvoice.paid === "paid") {
    supplier.TotalUnpaid = Number(supplier.TotalUnpaid || 0) - remainderMain;
  }

  await supplier.save({ session });

  await createPaymentHistoryV2({
    companyId,
    entryType: "invoice",
    transactionDate: newRefundPurchaseInvoice.date,
    amountTransactionCurrency: Number(
      newRefundPurchaseInvoice.invoiceGrandTotal || 0,
    ),
    amountMainCurrency: totalMain,
    supplierId: supplier._id,
    referenceId: newRefundPurchaseInvoice._id,
    sourceModule: "purchase",
    actionType: "refund",
    description: "Refund purchase invoice",
    transactionCurrency: currency?.currencyCode || "",
    session,
  });
};

exports.applyRefundPurchaseInventoryEffectsService = async ({
  companyId,
  session,
  invoicesItems,
  productMap,
  newRefundPurchaseInvoice,
}) => {
  const bulkProductUpdates = [];

  for (const item of invoicesItems) {
    if (item.type === "expense") {
      continue;
    } else if (item.type === "Service") {
      await createProductMovement({
        productId: item.id,
        reference: newRefundPurchaseInvoice._id,
        newQuantity: 0,
        quantity: item.soldQuantity,
        movementType: "out",
        source: "Refund Purchase Invoice",
        companyId,
        enterPrice: item.orginalBuyingPrice || item.convertedBuyingPrice || 0,
        stockId: item.selectedBatchStockId || null,
        buyingPrice: item.orginalBuyingPrice || item.convertedBuyingPrice || 0,
        exchangeRate: item.exchangeRate,
        movementDate: new Date(),
        session,
      });
    } else if (item.type === "unTracedproduct") {
      await unTracedproductLogModel.create(
        [
          {
            type: "out",
            name: item.name,
            quantity: item.quantity || 1,
            outPrice: item.convertedBuyingPrice || item.orginalBuyingPrice,
            outPriceMainCurrency:
              item.orginalBuyingPrice ||
              item.convertedBuyingPrice /
                newRefundPurchaseInvoice.currency.exchangeRate,
            totalWithoutTax: item.totalWithoutTax,
            total: item.total,
            tax: { _id: item.tax, taxValue: item.taxValue },
            sourceModule: "Refund Purchase Invoice",
            reference: newRefundPurchaseInvoice._id,
            referenceModel: "refundpurchaseinvoices",
            companyId,
          },
        ],
        { session },
      );
    } else if (item.type === "product") {
      const product = productMap.get(String(item.id));
      if (!product) {
        throw new ApiError(`Product not found for item ${item.name}`, 404);
      }

      if (!item.selectedBatchId) {
        throw new ApiError(
          `Selected batch is required for product "${item.name}"`,
          400,
        );
      }

      if (!item.selectedBatchStockId) {
        throw new ApiError(
          `Selected batch stock is required for product "${item.name}"`,
          400,
        );
      }

      const refundedQuantity = Number(item.refundedQuantity || 0);
      if (!Number.isFinite(refundedQuantity) || refundedQuantity <= 0) {
        throw new ApiError(
          `Refunded quantity is invalid for product "${item.name}"`,
          400,
        );
      }

      const selectedBatch = await ProductBatchModel.findOne({
        _id: item.selectedBatchId,
        productId: item.id,
        companyId,
        status: "active",
      }).session(session);

      if (!selectedBatch) {
        throw new ApiError(
          `Selected batch not found for product "${item.name}"`,
          404,
        );
      }

      if (
        String(selectedBatch.stockId || "") !==
        String(item.selectedBatchStockId || "")
      ) {
        throw new ApiError(
          `Selected batch stock mismatch for product "${item.name}"`,
          400,
        );
      }

      const batchRemaining = Number(selectedBatch.remaining || 0);
      if (batchRemaining < refundedQuantity) {
        throw new ApiError(
          `Batch remaining is not enough for product "${item.name}"`,
          400,
        );
      }

      const stockRow = (product.stocks || []).find(
        (stock) => String(stock.stockId) === String(item.selectedBatchStockId),
      );

      if (!stockRow) {
        throw new ApiError(
          `Stock row not found for product "${item.name}"`,
          400,
        );
      }

      const currentStockQty = Number(stockRow.productQuantity || 0);
      if (currentStockQty < refundedQuantity) {
        throw new ApiError(
          `Insufficient stock for product "${item.name}"`,
          400,
        );
      }

      selectedBatch.remaining = batchRemaining - refundedQuantity;
      await selectedBatch.save({ session });

      await batchLedgerModel.create(
        [
          {
            productId: item.id,
            companyId,
            stockId: item.selectedBatchStockId,
            type: "out",
            quantity: refundedQuantity,
            batchId: selectedBatch._id,
            referenceType: "refund_purchase",
            referenceId: newRefundPurchaseInvoice._id,
            movementDate: new Date(newRefundPurchaseInvoice.date),
          },
        ],
        { session },
      );

      await createProductMovement({
        productId: item.id,
        reference: newRefundPurchaseInvoice._id,
        newQuantity: currentStockQty - refundedQuantity,
        quantity: refundedQuantity,
        movementType: "out",
        source: "Refund Purchase Invoice",
        companyId,
        outPrice: Number(selectedBatch.costBuyingPrice || 0),
        stockId: item.selectedBatchStockId,
        buyingPrice: item.orginalBuyingPrice,
        exchangeRate: item.exchangeRate,
        movementDate: new Date(newRefundPurchaseInvoice.date),
        batchId: selectedBatch._id,
        session,
      });

      const remainingBatches = await ProductBatchModel.find({
        productId: item.id,
        companyId,
        stockId: item.selectedBatchStockId,
        status: "active",
        remaining: { $gt: 0 },
      }).session(session);

      let remainingTotalQty = 0;
      let remainingTotalCost = 0;

      for (const batch of remainingBatches) {
        const qty = Number(batch.remaining || 0);
        remainingTotalQty += qty;
        remainingTotalCost += qty * Number(batch.costBuyingPrice || 0);
      }

      const newAvgCost =
        remainingTotalQty > 0 ? remainingTotalCost / remainingTotalQty : 0;

      bulkProductUpdates.push({
        updateOne: {
          filter: {
            _id: item.id,
            companyId,
            "stocks.stockId": item.selectedBatchStockId,
          },
          update: {
            $inc: {
              "stocks.$.productQuantity": -refundedQuantity,
            },
            $set: {
              costBuyingPrice: newAvgCost < 0 ? 0 : newAvgCost,
            },
          },
        },
      });
    }
  }

  if (bulkProductUpdates.length > 0) {
    await productModel.bulkWrite(bulkProductUpdates, { session });
  }
};

exports.applyRefundPurchaseFinancialEffectsService = async ({
  req,
  companyId,
  session,
  supplier,
  newRefundPurchaseInvoice,
  formattedDate,
  nextCounterPayment,
}) => {
  let parsedFinancialFund = null;

  if (req.body.financailFund) {
    parsedFinancialFund =
      typeof req.body.financailFund === "string"
        ? JSON.parse(req.body.financailFund)
        : req.body.financailFund;
  }

  const paymentInFundCurrency = Number(req.body.paymentInFundCurrency || 0);
  const paymentInMainCurrency = Number(req.body.paymentInMainCurrency || 0);
  const paymentInInvoiceCurrency = Number(
    req.body.paymentInInvoiceCurrency || 0,
  );
  const counter = Number(req.body.counter || 0);
  const exchangeRate = Number(req.body.exchangeRate || 1);

  if (paymentInMainCurrency <= 0) {
    return {
      payment: null,
      financialFund: null,
    };
  }

  const financialFund = await financialFundsModel
    .findOne({ _id: parsedFinancialFund?.id, companyId })
    .session(session);

  if (!financialFund) {
    throw new ApiError("Financial fund not found", 404);
  }

  financialFund.fundBalance += paymentInFundCurrency;

  const createdPayments = await paymentModel.create(
    [
      {
        source: {
          id: supplier._id,
          name: supplier.supplierName || supplier.name,
        },
        destination: {
          id: financialFund._id,
          name: financialFund.fundName,
        },
        sourceType: "supplier",
        destinationType: "fund",
        totalInPaymentCurrency: paymentInInvoiceCurrency,
        totalMainCurrency: paymentInMainCurrency,
        paymentInDestinationCurrency: paymentInFundCurrency,
        paymentCurrency: {
          id: req.body.currency?.id,
          name: req.body.currency?.name,
          code: req.body.currency?.currencyCode,
          exchangeRate: req.body.currency?.exchangeRate || exchangeRate,
        },
        destinationExchangeRate: financialFund?.fundCurrency?.exchangeRate || 1,
        destinationCurrencyCode: parsedFinancialFund?.code,
        type: "refund-purchase",
        paymentType: "Deposit",
        description: req.body.paymentDescription,
        date: req.body.paymentDate || formattedDate,
        counter: counter + nextCounterPayment.seq,
        companyId,
        payid: [
          {
            id: newRefundPurchaseInvoice._id,
            status: req.body.paid,
            invoiceTotal: req.body.invoiceGrandTotal,
            invoiceName: req.body.invoiceName,
            invoiceCurrencyCode: req.body.currency?.currencyCode,
            paymentInFundCurrency,
            paymentMainCurrency: paymentInMainCurrency,
            paymentInInvoiceCurrency: paymentInInvoiceCurrency,
          },
        ],
      },
    ],
    { session },
  );

  const payment = createdPayments[0];

  await createPaymentHistoryV2({
    companyId,
    entryType: "payment",
    transactionDate: req.body.paymentDate || formattedDate,
    amountTransactionCurrency: paymentInFundCurrency,
    amountMainCurrency: paymentInMainCurrency,
    supplierId: supplier._id,
    referenceId: newRefundPurchaseInvoice._id,
    sourceModule: "purchase",
    actionType: "refund",
    paymentId: payment._id,
    balanceEffectType: "Withdrawal",
    description: req.body.paymentDescription,
    transactionCurrency: parsedFinancialFund?.code,
    session,
  });

  const createdReports = await reportsFinancialFunds.create(
    [
      {
        date: req.body.paymentDate || formattedDate,
        ref: newRefundPurchaseInvoice._id,
        amount: paymentInFundCurrency,
        type: "refund-purchase",
        exchangeRate,
        financialFundId: parsedFinancialFund?.id,
        financialFundRest: financialFund.fundBalance,
        paymentType: "Deposit",
        payment: payment._id,
        description: req.body.paymentDescription,
        companyId,
      },
    ],
    { session },
  );

  const reports = createdReports[0];

  newRefundPurchaseInvoice.payments.push({
    payment: paymentInFundCurrency,
    paymentMainCurrency: paymentInMainCurrency,
    financialFunds: financialFund.fundName,
    financialFundsCurrencyCode: parsedFinancialFund?.code,
    date: req.body.paymentDate || formattedDate,
    paymentID: payment._id,
    paymentInInvoiceCurrency: paymentInInvoiceCurrency,
    financialFundsId: parsedFinancialFund?.id,
  });

  newRefundPurchaseInvoice.reportsBalanceId = reports._id;

  await newRefundPurchaseInvoice.save({ session });
  await financialFund.save({ session });

  return {
    payment,
    financialFund,
  };
};
