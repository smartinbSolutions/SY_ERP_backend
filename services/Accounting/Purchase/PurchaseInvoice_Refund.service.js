const purchaseinvoicesModel = require("../../../models/purchaseinvoicesModel");
const refundPurchaseInviceModel = require("../../../models/refundPurchaseInviceModel");
const invoiceHistoryModel = require("../../../models/invoiceHistoryModel");
const ProductBatchModel = require("../../../models/prodcutBatchModel");
const ApiError = require("../../../utils/apiError");

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

  const pageSize = Number(req.query.limit) || 20;
  const page = parseInt(req.query.page, 10) || 1;
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

  const purchaseRefund = await refundPurchaseInviceModel.findOne({
    _id: id,
    companyId,
  });

  if (!purchaseRefund) {
    throw new ApiError(`No purchase refund for this id ${id}`, 404);
  }

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
      400
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
      404
    );
  }

  const refundableItems = [];

  for (const invoice of purchaseInvoices) {
    const invoiceItems = Array.isArray(invoice.invoicesItems)
      ? invoice.invoicesItems
      : [];

    for (let index = 0; index < invoiceItems.length; index++) {
      const item = invoiceItems[index];

      if (
        item.type === "expense" ||
        item.type === "Service" ||
        item.type === "unTracedproduct"
      ) {
        continue;
      }

      const productId = item.id || null;

      let batches = [];
      if (productId) {
        batches = await ProductBatchModel.find({
          companyId,
          productId,
          sourceType: "purchase",
          sourceId: invoice._id,
          status: "active",
          remaining: { $gt: 0 },
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
        type: item.type || "product",

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
        })),
      });
    }
  }

  return {
    refundableItems,
    purchaseInvoicesCount: purchaseInvoices.length,
  };
};
