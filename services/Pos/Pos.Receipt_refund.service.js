const mongoose = require("mongoose");
const receipt_refundModel = require("../../models/Pos/pos.receipt_refund.model");
const productModel = require("../../models/Stocks/products/productModel");
const ApiError = require("../../utils/apiError");
const { createProductMovement } = require("../../utils/productMovement");
const productBatchModel = require("../../models/Stocks/products/prodcutBatchModel");
const batchLedgerModel = require("../../models/Stocks/products/batchLedgerModel");
const {
  handleFundPaymentEntity,
} = require("../Accounting/CurrentAssets/Payments/Payment.handlers");

exports.findAllPosReceiptsRefundService = async ({ req, companyId }) => {
  const pageSize = Number(req.query.limit) || 10;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * pageSize;

  // ── Build match stage ──────────────────────────────────────────────────
  let matchStage = { companyId };

  if (req.query.salesPointID) {
    matchStage.salesPoint = mongoose.Types.ObjectId.createFromHexString(
      req.query.salesPointID
    );
  }

  if (req.query.fundId) {
    matchStage["financialFund.fundId"] = req.query.fundId;
  }

  if (req.query.startDate || req.query.endDate) {
    matchStage.createdAt = {};
    if (req.query.startDate) {
      matchStage.createdAt.$gte = new Date(req.query.startDate);
    }
    if (req.query.endDate) {
      const end = new Date(req.query.endDate);
      end.setHours(23, 59, 59, 999);
      matchStage.createdAt.$lte = end;
    }
  }

  let query = matchStage;
  if (req.query.keyword) {
    query = {
      $and: [
        matchStage,
        { receiptCounter: { $regex: req.query.keyword, $options: "i" } },
      ],
    };
  }
  // ── Run paginated + stats in parallel ──────────────────────────────────
  const [totalItems, refund, statsAgg] = await Promise.all([
    receipt_refundModel.countDocuments(query),

    receipt_refundModel
      .find(query)
      .populate({ path: "salesPoint" })
      .populate({ path: "receipt" })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize),

    receipt_refundModel.aggregate([
      { $match: query },
      { $unwind: { path: "$financialFund", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            fundId: "$financialFund.fundId",
            fundName: "$financialFund.fundName",
            currencyCode: "$financialFund.currencyCode",
          },
          count: { $sum: 1 },
          totalAmount: {
            $sum: { $toDouble: "$financialFund.allocatedAmount" },
          },
          totalInvoiceAmount: { $sum: "$invoiceGrandTotal" },
          totalMainCurrency: { $sum: "$totalInMainCurrency" },
        },
      },
      {
        $project: {
          _id: 0,
          fundId: "$_id.fundId",
          fundName: "$_id.fundName",
          currencyCode: "$_id.currencyCode",
          count: 1,
          totalAmount: 1,
          totalInvoiceAmount: 1,
          totalMainCurrency: 1,
        },
      },
    ]),
  ]);

  // ── Overall totals from fund stats ─────────────────────────────────────
  const totalStats = statsAgg.reduce(
    (acc, f) => {
      acc.count += f.count;
      acc.totalInvoiceAmount += f.totalInvoiceAmount;
      acc.totalMainCurrency += f.totalMainCurrency;
      return acc;
    },
    { count: 0, totalInvoiceAmount: 0, totalMainCurrency: 0 }
  );

  return {
    totalItems,
    totalPages: Math.ceil(totalItems / pageSize),
    refund,
    stats: {
      total: totalStats,
      byFund: statsAgg,
    },
  };
};

exports.findOnePosReceiptRefundService = async ({ req, companyId }) => {
  const { id } = req.params;
  const refund = await receipt_refundModel
    .findOne({ _id: id, companyId })
    .populate({ path: "salesPoint", populate: { path: "salesPointCurrency" } })
    .populate("receipt");
  if (!refund) {
    throw new ApiError(`No receipt refund for this id ${id}`, 404);
  }

  return refund;
};

exports.createPosReceiptRefundService = async ({
  req,
  session,
  companyId,
  nextCounterRecipt = 0,
  dateTurkey,
  receipt,
}) => {
  const { cartItems } = req.body;

  if (!companyId) {
    throw new ApiError("companyId is required", 400);
  }

  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    throw new ApiError("The cart is empty", 400);
  }

  if (!receipt) {
    throw new ApiError("Original POS receipt not found", 404);
  }

  // ── Validate refund quantities against returnCartItem ──────────────────
  for (const incomingItem of cartItems) {
    const refundQty = Number(incomingItem.soldQuantity || 0);

    if (refundQty <= 0) {
      throw new ApiError("Refund quantity must be greater than zero", 400);
    }

    const matchingItem = (receipt.returnCartItem || []).find(
      (item) => String(item.id) === String(incomingItem.id)
    );

    if (!matchingItem) {
      throw new ApiError(
        `${incomingItem.name || "Item"} is not returnable`,
        400
      );
    }

    const remainingQty = Number(matchingItem.soldQuantity || 0);

    if (refundQty > remainingQty) {
      throw new ApiError(
        `${
          incomingItem.name || matchingItem.name
        } refund quantity exceeds returnable quantity`,
        400
      );
    }
  }

  // ── Build refund receipt ───────────────────────────────────────────────
  req.body.companyId = companyId;
  req.body.date = dateTurkey;
  req.body.salesPoint = receipt.salesPoint;
  req.body.stock = receipt.stock;
  req.body.counter =
    Number(req.body.counter || 0) + Number(nextCounterRecipt.seq || 0);

  const financialFund = req.body.financialFund || req.body.financailFund;
  if (financialFund) {
    req.body.financialFund = Array.isArray(financialFund)
      ? financialFund
      : [financialFund];
  }

  // ── Create ─────────────────────────────────────────────────────────────
  const createReciptRefund = await receipt_refundModel.create([req.body], {
    session,
  });

  return {
    recipt: createReciptRefund[0],
  };
};

exports.applyReciptRefundFundEffectService = async ({
  req,
  session,
  companyId,
  newReceipt,
  dateTurkey,
}) => {
  const financialFund = req.body.financailFund || req.body.financialFund;
  const fund = Array.isArray(financialFund) ? financialFund[0] : financialFund;
  const paymentInFundCurrency =
    req.body.paymentInFundCurrency || fund?.allocatedAmount;

  if (!fund?.id && !fund?.fundId) {
    throw new ApiError("Financial fund is required", 400);
  }

  if (Number(paymentInFundCurrency || 0) <= 0) {
    throw new ApiError("Payment amount is required", 400);
  }

  await handleFundPaymentEntity({
    fund: {
      ...fund,
      id: fund.id || fund.fundId,
    },
    companyId,
    paymentInFundCurrency: paymentInFundCurrency,
    paymentId: null,
    refId: newReceipt.recipt._id,
    refType: "receipt",
    source: "pos_receipt",
    date: dateTurkey,
    description: "Receipt Refund",
    effectSide: "source",
    session,
    createdBy: req.user.id,
  });

  return true;
};

exports.applyReciptRefundInventoryEffectService = async ({
  req,
  session,
  companyId,
  newReceipt,
  dateTurkey,
  receipt,
}) => {
  const { cartItems = [] } = req.body;

  if (!receipt) throw new ApiError("Original POS receipt not found", 404);
  if (!receipt.stock)
    throw new ApiError("Original POS receipt stock is required", 400);

  const stockId = receipt.stock;
  const bulkProductUpdates = [];

  // ── Shared helper: restore one batch slice ───────────────────────────────
  const restoreBatchSlice = async (batch, qtyToRestore, item) => {
    batch.remaining = Number(batch.remaining || 0) + qtyToRestore;
    await batch.save({ session });

    await createProductMovement({
      session,
      productId: item.id,
      reference: newReceipt.recipt._id,
      quantity: qtyToRestore,
      movementType: "in",
      source: "Refund POS Receipt",
      companyId,
      enterPrice: Number(batch.buyingprice || 0),
      enterPriceMainCurrency:
        Number(batch.buyingprice || 0) / Number(batch.exchangeRate || 1),
      stockId,
      sellingPrice: Number(item.sellingPrice || 0),
      buyingPrice: Number(batch.buyingprice || 0),
      exchangeRate: Number(batch.exchangeRate || 1),
      batchId: batch._id,
    });

    await batchLedgerModel.create(
      [
        {
          productId: item.id,
          companyId,
          stockId,
          type: "in",
          quantity: qtyToRestore,
          batchId: batch._id,
          referenceType: "Receipt Refund",
          referenceId: newReceipt.recipt._id,
          movementDate: dateTurkey,
          actionType: "create",
        },
      ],
      { session }
    );

    return { id: batch._id.toString(), quantity: qtyToRestore };
  };

  // ── Main loop ────────────────────────────────────────────────────────────
  for (const item of cartItems) {
    const refundQty = Number(item.soldQuantity || 0);
    if (refundQty <= 0) continue;

    const product = await productModel.findById(item.id).session(session);
    if (!product) throw new ApiError("Product not found", 404);
    if (product.type === "Service") continue;

    const originalReceiptItem = receipt.cartItems.find(
      (i) => String(i.id) === String(item.id)
    );

    if (!originalReceiptItem) {
      throw new ApiError(`${product.name} was not sold in this receipt`, 400);
    }

    if (refundQty > Number(originalReceiptItem.soldQuantity || 0)) {
      throw new ApiError(
        `${product.name} refund quantity exceeds sold quantity`,
        400
      );
    }

    const stockData = product.stocks.find(
      (s) => String(s.stockId) === String(stockId)
    );

    if (!stockData) throw new ApiError(`${product.name} stock not found`, 404);

    // ── Resolve which batches to restore ────────────────────────────────
    const refundBatches =
      item.batches?.length > 0
        ? item.batches
        : (originalReceiptItem.batches || []).reduce((acc, batchItem) => {
            const restoredSoFar = acc.reduce(
              (sum, b) => sum + Number(b.quantity || 0),
              0
            );
            const remaining = refundQty - restoredSoFar;
            if (remaining <= 0) return acc;
            const qty = Math.min(Number(batchItem.quantity || 0), remaining);
            if (qty > 0) acc.push({ id: batchItem.id, quantity: qty });
            return acc;
          }, []);

    const itemBatches = [];

    if (refundBatches.length > 0) {
      // ── Restore original FIFO batches ──────────────────────────────
      for (const batchItem of refundBatches) {
        const qtyToRestore = Number(batchItem.quantity || 0);
        if (qtyToRestore <= 0) continue;

        const batch = await productBatchModel
          .findById(batchItem.id)
          .session(session);

        if (!batch) throw new ApiError(`Batch not found ${batchItem.id}`, 404);

        itemBatches.push(await restoreBatchSlice(batch, qtyToRestore, item));
      }
    } else {
      // ── Fallback: latest batch ─────────────────────────────────────
      const latestBatch = await productBatchModel
        .findOne({ productId: item.id, companyId, stockId })
        .sort({ createdAt: -1 })
        .session(session);

      if (!latestBatch)
        throw new ApiError(`No batch found for ${product.name}`, 404);

      itemBatches.push(await restoreBatchSlice(latestBatch, refundQty, item));
    }

    // ── Attach batches to refund receipt ────────────────────────────────
    const receiptItem = newReceipt.recipt.cartItems.find(
      (i) => String(i.id) === String(item.id)
    );
    if (receiptItem) receiptItem.batches = itemBatches;

    // ── Recompute avg cost (mirror normal service) ───────────────────────
    const remainingBatches = await productBatchModel
      .find({ productId: item.id, companyId, stockId, remaining: { $gt: 0 } })
      .session(session);

    let remainingQty = 0;
    let remainingCost = 0;

    for (const b of remainingBatches) {
      const qty = Number(b.remaining || 0);
      const cost = Number(b.buyingprice || 0) / Number(b.exchangeRate || 1);
      remainingQty += qty;
      remainingCost += qty * cost;
    }

    const newAvgCost =
      remainingQty > 0 && Number.isFinite(remainingCost / remainingQty)
        ? remainingCost / remainingQty
        : 0;

    bulkProductUpdates.push({
      updateOne: {
        filter: { _id: item.id, "stocks.stockId": stockId },
        update: {
          $inc: {
            "stocks.$.productQuantity": refundQty,
            sold: -refundQty,
            soldByMonth: -refundQty,
            soldByWeek: -refundQty,
          },
          $set: { costBuyingPrice: newAvgCost },
        },
      },
    });
  }

  if (bulkProductUpdates.length > 0) {
    await productModel.bulkWrite(bulkProductUpdates, { session });
  }

  await newReceipt.recipt.save({ session });

  return true;
};

exports.findRefundReceiptForDateService = async ({ req, companyId }) => {
  const specificDate = new Date().toISOString().slice(0, 10);
  const specificDateString = specificDate;

  const { id } = req.params;

  const receipt = await receipt_refundModel
    .find({
      createdAt: { $gte: specificDateString },
      companyId,
      salesPoint: id,
    })
    .sort({ createdAt: -1 });

  return receipt;
};
