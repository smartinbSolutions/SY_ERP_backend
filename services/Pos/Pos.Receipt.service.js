const financialFundsModel = require("../../models/Accounting/CurrentAssets/financialFundsModel");
const receiptModel = require("../../models/Pos/pos.receipt.model");
const ApiError = require("../../utils/apiError");
const reportsFinancialFunds = require("../../models/Accounting/CurrentAssets/reportsFinancialFunds");
const productModel = require("../../models/productModel");
const productBatchModel = require("../../models/Stocks/products/prodcutBatchModel");
const { createProductMovement } = require("../../utils/productMovement");
const { default: mongoose } = require("mongoose");
const batchLedgerModel = require("../../models/Stocks/products/batchLedgerModel");
const salesPointModel = require("../../models/salesPointModel");
const {
  handleFundPaymentEntity,
} = require("../Accounting/CurrentAssets/Payments/Payment.handlers");

exports.buildTurkeyDate = () => {
  const now = new Date();

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);

  const dateParts = {};

  parts.forEach(({ type, value }) => {
    dateParts[type] = value;
  });

  const milliseconds = now.getMilliseconds().toString().padStart(3, "0");

  return `${dateParts.year}-${dateParts.month}-${dateParts.day}T${dateParts.hour}:${dateParts.minute}:${dateParts.second}.${milliseconds}Z`;
};

exports.createPosReceiptService = async ({
  req,
  session,
  companyId,
  nextCounterRecipt = 0,
  dateTurkey,
}) => {
  const { salesPoint, cartItems } = req.body;

  if (!cartItems || cartItems.length === 0) {
    throw new ApiError("The cart is empty", 400);
  }

  req.body.date = dateTurkey;
  req.body.returnCartItem = cartItems;
  req.body.counter =
    Number(req.body.counter || 0) + Number(nextCounterRecipt.seq || 0);

  await salesPointModel.findOneAndUpdate(
    {
      _id: salesPoint,
      companyId,
    },
    {
      $inc: {
        sold: 1,
      },
    },
    {
      new: true,
      session,
    },
  );

  const createRecipt = await receiptModel.create([req.body], {
    session,
  });

  return {
    recipt: createRecipt[0],
  };
};

exports.applyFundEffectService = async ({
  req,
  session,
  companyId,
  newReceipt,
  dateTurkey,
}) => {
  const {
    financialFund = [],
    isMultFunds,
    change = 0,
    changeFund = {},
    totalInMainCurrency = 0,
  } = req.body;
  const bulkUpdates = [];

  const validFunds = financialFund.filter(
    (f) => Number(f.allocatedAmount || 0) > 0 && f.fundId,
  );

  for (const fund of validFunds) {
    let changeAmount = 0;

    if (validFunds.length === 1 && !isMultFunds) {
      changeAmount = Number(change || 0);
    } else if (isMultFunds && changeFund?.id === fundId) {
      changeAmount = Number(changeFund.changeInFundCurrency || 0);
    }

    const finalAmount = fund.allocatedAmount - changeAmount;
    fund.id = fund.fundId;

    await handleFundPaymentEntity({
      fund,
      companyId,
      paymentInFundCurrency: fund.allocatedAmount,
      paymentId: null,
      refId: newReceipt.recipt._id,
      refType: "receipt",
      source: "pos_receipt",
      date: dateTurkey,
      description: "Receipt",
      effectSide: "destination",
      session,
      createdBy: req.user.id,
    });
    // if (changeAmount > 0.1) {

    //   await reportsFinancialFunds.create(
    //     [
    //       {
    //         date: dateTurkey,
    //         amount: changeAmount,
    //         ref: newReceipt.recipt._id,
    //         type: "Withdrawal",
    //         financialFundId: fundId,
    //         financialFundRest: updatedFundBalance,
    //         exchangeRate,
    //         paymentType: "Withdrawal",
    //         companyId,
    //       },
    //     ],
    //     { session },
    //   );
    // }
  }

  return validFunds;
};

exports.applyReciptInventoryEffectService = async ({
  req,
  session,
  companyId,
  newReceipt,
  dateTurkey,
}) => {
  const { cartItems = [], stock: stockID } = req.body;

  if (!stockID) {
    throw new ApiError("Stock is required", 400);
  }

  const bulkProductUpdates = [];

  for (const item of cartItems) {
    const soldQty = Number(item.soldQuantity || 0);

    if (soldQty <= 0) continue;

    const product = await productModel.findById(item.id).session(session);

    if (!product) {
      throw new ApiError("Product not found", 404);
    }

    if (product.type === "Service") continue;

    const stockData = product.stocks.find(
      (s) => String(s.stockId) === String(stockID),
    );

    if (!stockData) {
      throw new ApiError(`${product.name} stock not found`, 404);
    }

    const currentQty = Number(stockData.productQuantity || 0);

    if (soldQty > currentQty) {
      throw new ApiError(`${product.name} has insufficient stock`, 400);
    }

    let qtyToSell = soldQty;

    const fifoMovements = [];
    const itemBatches = [];

    const batches = await productBatchModel
      .find({
        productId: item.id,
        companyId,
        stockId: stockID,
        remaining: { $gt: 0 },
      })
      .sort({ createdAt: 1 })
      .session(session);

    for (const batch of batches) {
      if (qtyToSell <= 0) break;

      const availableQty = Number(batch.remaining || 0);

      if (availableQty <= 0) continue;

      const usedQty = Math.min(availableQty, qtyToSell);

      batch.remaining = availableQty - usedQty;

      await batch.save({ session });

      qtyToSell -= usedQty;

      itemBatches.push({
        id: batch._id.toString(),
        quantity: usedQty,
      });

      fifoMovements.push({
        quantity: usedQty,
        costBuyingPrice: Number(batch.costBuyingPrice || 0),
        batchId: batch._id,
      });

      await batchLedgerModel.create(
        [
          {
            productId: item.id,
            companyId,
            stockId: stockID,
            type: "out",
            quantity: usedQty,
            batchId: batch._id,
            referenceType: "POS Receipt",
            referenceId: newReceipt.recipt._id,
            movementDate: dateTurkey,
            actionType: "create",
          },
        ],
        { session },
      );
    }

    if (qtyToSell > 0) {
      throw new ApiError(`${product.name} batch quantity is insufficient`, 400);
    }

    const receiptItem = newReceipt.recipt.cartItems.find(
      (i) => String(i.id) === String(item.id),
    );

    if (receiptItem) {
      receiptItem.batches = itemBatches;
    }

    let remainingQty = 0;
    let remainingCost = 0;

    const remainingBatches = await productBatchModel
      .find({
        productId: item.id,
        companyId,
        stockId: stockID,
        remaining: { $gt: 0 },
      })
      .session(session);

    for (const batch of remainingBatches) {
      const qty = Number(batch.remaining || 0);
      const cost = Number(batch.costBuyingPrice || 0);

      remainingQty += qty;
      remainingCost += qty * cost;
    }

    const newAvgCost = remainingQty > 0 ? remainingCost / remainingQty : 0;

    for (const movement of fifoMovements) {
      await createProductMovement({
        session,
        productId: product._id,
        reference: newReceipt.recipt._id,
        quantity: movement.quantity,
        movementType: "out",
        source: "POS Receipt",
        companyId,
        outPrice: movement.costBuyingPrice,
        stockId: stockID,
        sellingPrice: Number(item.sellingPrice || 0),
        exchangeRate: Number(item.exchangeRate || 1),
        batchId: movement.batchId,
      });
    }

    bulkProductUpdates.push({
      updateOne: {
        filter: {
          _id: item.id,
          "stocks.stockId": stockID,
          "stocks.productQuantity": { $gte: soldQty },
        },
        update: {
          $inc: {
            "stocks.$.productQuantity": -soldQty,
            sold: soldQty,
            soldByMonth: soldQty,
            soldByWeek: soldQty,
          },
          $set: {
            costBuyingPrice: newAvgCost,
          },
        },
      },
    });
  }

  if (bulkProductUpdates.length > 0) {
    const result = await productModel.bulkWrite(bulkProductUpdates, {
      session,
    });

    if (result.modifiedCount !== bulkProductUpdates.length) {
      throw new ApiError("Some products failed stock validation", 400);
    }
  }

  await newReceipt.recipt.save({ session });

  return true;
};

exports.findAllReceiptService = async ({ req, companyId }) => {
  const { startDate, endDate } = req.query;
  const filters = req.query?.filters ? JSON.parse(req.query?.filters) : {};

  const pageSize = Number(req.query.limit) || 10;
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
          $or: [
            { counter: { $regex: req.query.keyword, $options: "i" } },
            { employee: { $regex: req.query.keyword, $options: "i" } },
          ],
        },
      ],
    };
  }
  if (filters?.startDate || filters?.endDate) {
    query.date = {};
    if (filters?.startDate) {
      query.date.$gte = filters.startDate.slice(0, 10) + "T00:00:00.000Z";
    }
    if (filters?.endDate) {
      query.date.$lte = filters.endDate.slice(0, 10) + "T23:59:59.999Z";
    }
  }
  if (filters.employee) {
    query.employee = filters.employee;
  }
  if (filters.salesPoint) {
    query.salesPoint = filters.salesPoint;
  }
  if (startDate && endDate) {
    query.createdAt = {
      $gte: new Date(new Date(startDate).setHours(0, 0, 0, 0)),
      $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
    };
  } else if (startDate) {
    const start = new Date(startDate);
    const end = new Date();
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    query.createdAt = { $gte: start, $lte: end };
  }

  if (filters?.tags?.length) {
    query["tags.name"] = { $in: filters.tags.map((tag) => tag.name) };
  }
  let mongooseQuery = receiptModel.find(query);
  mongooseQuery = mongooseQuery.sort({ createdAt: -1 });
  const totalItems = await receiptModel.countDocuments(query);

  // Calculate total pages
  const totalPages = Math.ceil(totalItems / pageSize);

  // Apply pagination
  mongooseQuery = mongooseQuery
    .skip(skip)
    .limit(pageSize)
    .populate({ path: "employee" })
    .populate({ path: "salesPoint" });

  const receipt = await mongooseQuery;

  return {
    totalPages,
    totalItems,
    receipt,
  };
};

exports.findOneReceiptService = async ({ req, companyId }) => {
  const { id } = req.params;
  let query = { companyId };
  const isObjectId = mongoose.Types.ObjectId.isValid(id);

  if (isObjectId) {
    query = {
      _id: id,
      companyId,
    };
  } else {
    query = {
      counter: id,
      companyId,
    };
  }
  const receipt = await receiptModel
    .findOne(query)
    .populate("stock")
    .populate({ path: "salesPoint" });
  if (!receipt) {
    throw new ApiError(`No receipt found for this id ${id}`, 404);
  }

  return {
    receipt,
  };
};

exports.reverseReceiptInventoryEffectsService = async ({
  receipt,
  companyId,
  session,
  reversedBy,
  cancellationDate,
  mode = "cancel",
  stockId,
  dateTurkey,
}) => {
  const { cartItems = [] } = receipt;

  for (const item of cartItems) {
    const reverseQty = Number(item.soldQuantity || 0);

    if (reverseQty <= 0) continue;

    const product = await productModel.findById(item.id).session(session);

    if (!product || product.type === "Service") {
      continue;
    }

    const stockData = product.stocks.find(
      (s) => String(s.stockId) === String(stockId),
    );

    if (!stockData) {
      throw new ApiError(
        `Stock row not found for product ${product.name}`,
        400,
      );
    }

    const currentQty = Number(stockData.productQuantity || 0);

    let restoredTotalCost = 0;

    if (!item.batches || item.batches.length === 0) {
      throw new ApiError(
        `No batch data found for product ${product.name}`,
        400,
      );
    }

    for (const batchItem of item.batches) {
      const restoreQty = Number(batchItem.quantity || 0);

      if (restoreQty <= 0) continue;

      const batch = await productBatchModel
        .findById(batchItem.batchId || batchItem.id)
        .session(session);

      if (!batch) {
        throw new ApiError(
          `Batch not found ${batchItem.batchId || batchItem.id}`,
          404,
        );
      }

      batch.remaining = Number(batch.remaining || 0) + Number(restoreQty);

      batch.status = "active";
      batch.reversedBy = reversedBy;

      await batch.save({ session });

      await batchLedgerModel.create(
        [
          {
            productId: item.id,
            companyId,
            stockId: stockId,
            type: "in",
            quantity: restoreQty,
            batchId: batch._id,
            referenceType: "pos_receipt_cancel",
            referenceId: receipt._id,
            movementDate: cancellationDate,
            actionType: "cancel",
          },
        ],
        { session },
      );

      await createProductMovement({
        session,
        productId: item.id,
        reference: receipt._id,
        quantity: restoreQty,
        movementType: "in",
        source: "POS Receipt Cancellation",
        companyId,
        enterPrice: Number(batch.costBuyingPrice || 0),
        stockId: stockId,
        buyingPrice: Number(item.orginalBuyingPrice || 0),
        exchangeRate: item.exchangeRate,
        batchId: batch._id,
        movementDate: cancellationDate,
      });

      restoredTotalCost += restoreQty * Number(batch.costBuyingPrice || 0);
    }

    const remainingBatches = await productBatchModel
      .find({
        productId: item.id,
        companyId,
        stockId: stockId,
        remaining: { $gt: 0 },
      })
      .session(session);

    let remainingQty = 0;
    let remainingCost = 0;

    for (const b of remainingBatches) {
      const qty = Number(b.remaining || 0);
      const cost = Number(b.costBuyingPrice || 0);

      remainingQty += qty;
      remainingCost += qty * cost;
    }

    let newAvgCost = 0;

    if (remainingQty > 0) {
      newAvgCost = remainingCost / remainingQty;
    }

    if (!Number.isFinite(newAvgCost)) {
      newAvgCost = 0;
    }

    await productModel.updateOne(
      {
        _id: item.id,
        "stocks.stockId": stockId,
      },
      {
        $inc: {
          "stocks.$.productQuantity": reverseQty,
          sold: -reverseQty,
          soldByMonth: -reverseQty,
          soldByWeek: -reverseQty,
        },
        $set: {
          costBuyingPrice: newAvgCost,
        },
      },
      { session },
    );
  }

  return true;
};

exports.reverseReceiptFundEffectsService = async ({
  receipt,
  companyId,
  session,
  dateTurkey,
  createdBy,
}) => {
  if (receipt.type !== "cancel" && receipt.isRefund !== true) {
    if (receipt.financialFund && receipt.financialFund.length > 0) {
      for (const fund of receipt.financialFund) {
        const financialFund = await financialFundsModel
          .findOne({
            _id: fund.fundId,
            companyId,
          })
          .session(session);

        if (!financialFund) {
          throw new ApiError(`Financial fund ${fund.fundId} not found`, 404);
        }
        const amountToReverse =
          Number(fund.allocatedAmount || 0) - Number(fund.change || 0);
        await handleFundPaymentEntity({
          fund: {
            ...fund,
            id: fund.fundId || fund.id,
          },
          companyId,
          paymentInFundCurrency: amountToReverse,
          paymentId: null,
          refId: receipt._id,
          refType: "receipt",
          source: "pos_receipt",
          date: dateTurkey,
          description: "Receipt Canceled",
          effectSide: "source",
          session,
          createdBy,
        });
      }
      return;
    }
  } else {
    return "The type is cancel or Have Refund";
  }
};

exports.findReceiptForDateService = async ({ req, companyId }) => {
  const { keyword, sortBy, sortOrder } = req.query;
  const { id } = req.params;

  const specificDate = new Date().toISOString().slice(0, 10);

  // Build query object
  const query = {
    createdAt: { $gte: specificDate },
    type: "pos",
    salesPoint: id,
    companyId,
  };

  // Filtering
  if (keyword) {
    query.counter = { $regex: keyword, $options: "i" };
  }

  // Sorting
  let sort = { createdAt: -1 };
  if (sortBy) {
    const validSortFields = ["createdAt", "invoiceGrandTotal"];
    if (validSortFields.includes(sortBy)) {
      sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };
    }
  }

  const receipt = await receiptModel.find(query).sort(sort);

  return receipt;
};
