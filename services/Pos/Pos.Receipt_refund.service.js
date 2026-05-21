const receipt_refundModel = require("../../models/Pos/pos.receipt_refund.model");
const productModel = require("../../models/productModel");
const ApiError = require("../../utils/apiError");
const { createProductMovement } = require("../../utils/productMovement");
const productBatchModel = require("../../models/Stocks/products/prodcutBatchModel");
const batchLedgerModel = require("../../models/Stocks/products/batchLedgerModel");
const {
  handleFundPaymentEntity,
} = require("../Accounting/CurrentAssets/Payments/Payment.handlers");

exports.findAllPosReceiptsRefundService = async ({ req, companyId }) => {
  const pageSize = req.query.limit || 10;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * pageSize;
  let query = { companyId };

  if (req.query.salesPointID) {
    query.salesPoint = req.query.salesPointID;
  }

  if (req.query.keyword) {
    query = {
      $and: [
        query,
        {
          $or: [{ counter: req.query.keyword }],
        },
      ],
    };
  }
  let mongooseQuery = receipt_refundModel
    .find(query)
    .populate({ path: "salesPoint" });
  mongooseQuery = mongooseQuery.sort({ createdAt: -1 });

  const totalItems = await receipt_refundModel.countDocuments(query);

  const totalPages = Math.ceil(totalItems / pageSize);
  mongooseQuery = mongooseQuery.skip(skip).limit(pageSize);

  const refund = await mongooseQuery;

  return {
    totalItems,
    totalPages,
    refund,
  };
};

exports.findOnePosReceiptRefundService = async ({ req, companyId }) => {
  const { id } = req.params;
  const refund = await receipt_refundModel
    .findOne({ _id: id, companyId })
    .populate({ path: "salesPoint" });
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

  if (!Array.isArray(receipt.returnCartItem)) {
    receipt.returnCartItem = [];
  }

  for (const incomingItem of cartItems) {
    const refundQty = Number(incomingItem.soldQuantity || 0);

    if (refundQty <= 0) {
      throw new ApiError("Refund quantity must be greater than zero", 400);
    }

    const matchingItem = receipt.returnCartItem.find(
      (item) => String(item.id) === String(incomingItem.id),
    );

    if (!matchingItem) {
      throw new ApiError(
        `${incomingItem.name || "Item"} is not returnable`,
        400,
      );
    }

    const remainingQty = Number(matchingItem.soldQuantity || 0);

    if (refundQty > remainingQty) {
      throw new ApiError(
        `${incomingItem.name || matchingItem.name} refund quantity exceeds returnable quantity`,
        400,
      );
    }

    matchingItem.soldQuantity = remainingQty - refundQty;
    matchingItem.total = Math.max(
      0,
      Number(matchingItem.total || 0) - Number(incomingItem.total || 0),
    );
    matchingItem.totalWithoutTax = Math.max(
      0,
      Number(matchingItem.totalWithoutTax || 0) -
        Number(incomingItem.totalWithoutTax || 0),
    );
    matchingItem.taxValue = Math.max(
      0,
      Number(matchingItem.taxValue || 0) - Number(incomingItem.taxValue || 0),
    );
  }

  receipt.isRefund = receipt.returnCartItem.every(
    (item) => Number(item.soldQuantity || 0) <= 0,
  );
  receipt.markModified("returnCartItem");

  req.body.companyId = companyId;
  req.body.date = dateTurkey;

  const financialFund = req.body.financialFund || req.body.financailFund;
  if (financialFund) {
    req.body.financialFund = Array.isArray(financialFund)
      ? financialFund
      : [financialFund];
  }

  req.body.counter =
    Number(req.body.counter || 0) + Number(nextCounterRecipt.seq || 0);
  req.body.salesPoint = receipt.salesPoint;
  req.body.receipt = receipt.counter;
  req.body.stock = receipt.stock;
  const createReciptRefund = await receipt_refundModel.create([req.body], {
    session,
  });

  await receipt.save({ session });

  return {
    recipt: createReciptRefund[0],
    isFullyRefunded: receipt.isRefund,
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

  if (!receipt) {
    throw new ApiError("Original POS receipt not found", 404);
  }

  if (!receipt.stock) {
    throw new ApiError("Original POS receipt stock is required", 400);
  }

  const bulkProductUpdates = [];

  for (const item of cartItems) {
    const refundQty = Number(item.soldQuantity || 0);

    if (refundQty <= 0) continue;

    const product = await productModel.findById(item.id).session(session);

    if (!product) {
      throw new ApiError("Product not found", 404);
    }

    if (product.type === "Service") continue;

    const originalReceiptItem = receipt.cartItems.find(
      (i) => String(i.id) === String(item.id),
    );

    if (!originalReceiptItem) {
      throw new ApiError(`${product.name} was not sold in this receipt`, 400);
    }

    if (refundQty > Number(originalReceiptItem.soldQuantity || 0)) {
      throw new ApiError(
        `${product.name} refund quantity exceeds sold quantity`,
        400,
      );
    }

    const stockData = product.stocks.find(
      (s) => String(s.stockId) === String(receipt.stock),
    );

    if (!stockData) {
      throw new ApiError(`${product.name} stock not found`, 404);
    }

    const itemBatches = [];
    const refundBatches =
      item.batches?.length > 0
        ? item.batches
        : (originalReceiptItem.batches || []).reduce((batches, batchItem) => {
            const restoredQty = batches.reduce(
              (sum, batch) => sum + Number(batch.quantity || 0),
              0,
            );
            const remainingQty = refundQty - restoredQty;

            if (remainingQty <= 0) return batches;

            const quantity = Math.min(
              Number(batchItem.quantity || 0),
              remainingQty,
            );

            if (quantity > 0) {
              batches.push({
                id: batchItem.id,
                quantity,
              });
            }

            return batches;
          }, []);

    if (refundBatches.length > 0) {
      for (const batchItem of refundBatches) {
        const batch = await productBatchModel
          .findById(batchItem.id)
          .session(session);

        if (!batch) {
          throw new ApiError(`Batch not found ${batchItem.id}`, 404);
        }

        const qtyToRestore = Number(batchItem.quantity || 0);

        if (qtyToRestore <= 0) continue;

        batch.remaining = Number(batch.remaining || 0) + qtyToRestore;

        await batch.save({ session });

        itemBatches.push({
          id: batch._id.toString(),
          quantity: qtyToRestore,
        });

        await createProductMovement({
          session,
          productId: product._id,
          reference: newReceipt.recipt._id,
          quantity: qtyToRestore,
          movementType: "in",
          source: "Refund POS Receipt",
          companyId,
          enterPrice: Number(batch.costBuyingPrice || 0),
          stockId: receipt.stock,
          sellingPrice: Number(item.sellingPrice || 0),
          exchangeRate: Number(item.exchangeRate || 1),
          batchId: batch._id,
        });

        await batchLedgerModel.create(
          [
            {
              productId: item.id,
              companyId,
              stockId: receipt.stock,
              type: "in",
              quantity: qtyToRestore,
              batchId: batch._id,
              referenceType: "Receipt Refund",
              referenceId: newReceipt.recipt._id,
              movementDate: dateTurkey,
              actionType: "create",
            },
          ],
          { session },
        );
      }
    } else {
      const latestBatch = await productBatchModel
        .findOne({
          productId: item.id,
          companyId,
          stockId: receipt.stock,
        })
        .sort({ createdAt: -1 })
        .session(session);

      if (!latestBatch) {
        throw new ApiError(`No batch found for ${product.name}`, 404);
      }

      latestBatch.remaining = Number(latestBatch.remaining || 0) + refundQty;

      await latestBatch.save({ session });

      itemBatches.push({
        id: latestBatch._id.toString(),
        quantity: refundQty,
      });

      await createProductMovement({
        session,
        productId: product._id,
        reference: newReceipt.recipt._id,
        quantity: refundQty,
        movementType: "in",
        source: "Refund POS Receipt",
        companyId,
        enterPrice: Number(latestBatch.costBuyingPrice || 0),
        stockId: receipt.stock,
        sellingPrice: Number(item.sellingPrice || 0),
        exchangeRate: Number(item.exchangeRate || 1),
        batchId: latestBatch._id,
      });

      await batchLedgerModel.create(
        [
          {
            productId: item.id,
            companyId,
            stockId: receipt.stock,
            type: "in",
            quantity: refundQty,
            batchId: latestBatch._id,
            referenceType: "Receipt Refund",
            referenceId: newReceipt.recipt._id,
            movementDate: dateTurkey,
            actionType: "create",
          },
        ],
        { session },
      );
    }

    const receiptItem = newReceipt.recipt.cartItems.find(
      (i) => String(i.id) === String(item.id),
    );

    if (receiptItem) {
      receiptItem.batches = itemBatches;
    }

    const remainingBatches = await productBatchModel
      .find({
        productId: item.id,
        companyId,
        stockId: receipt.stock,
        remaining: { $gt: 0 },
      })
      .session(session);

    let remainingQty = 0;
    let remainingCost = 0;

    for (const batch of remainingBatches) {
      const qty = Number(batch.remaining || 0);
      const cost = Number(batch.costBuyingPrice || 0);

      remainingQty += qty;
      remainingCost += qty * cost;
    }
    const newAvgCost = remainingQty > 0 ? remainingCost / remainingQty : 0;

    bulkProductUpdates.push({
      updateOne: {
        filter: {
          _id: item.id,
          "stocks.stockId": receipt.stock,
        },
        update: {
          $inc: {
            "stocks.$.productQuantity": refundQty,
            sold: -refundQty,
            soldByMonth: -refundQty,
            soldByWeek: -refundQty,
          },
          $set: {
            costBuyingPrice: newAvgCost,
          },
        },
      },
    });
  }

  if (bulkProductUpdates.length > 0) {
    await productModel.bulkWrite(bulkProductUpdates, {
      session,
    });
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
