const asyncHandler = require("express-async-handler");
const productModel = require("../models/productModel");
const reconciliationModel = require("../models/stockReconciliationModel");
const { createProductMovement } = require("../utils/productMovement");
const prodcutBatchModel = require("../models/prodcutBatchModel");
const { default: mongoose } = require("mongoose");
const { createProductBatch } = require("./productBatchServices");

exports.checkStockReconciliation = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const { stockid } = req.params;
  const reconciliation = await reconciliationModel.findOne({
    stockID: stockid,
    isClosed: false,
    companyId,
  });

  if (reconciliation) {
    return res.status(209).json({
      success: true,
      message: "You have an open reconciliation for this Stock",
      data: reconciliation,
      canReconcile: false,
    });
  }

  return res.status(200).json({ success: true, canReconcile: true });
});

async function runWithRetry(fn, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      // MongoDB WriteConflict
      if (err?.code === 112 || err?.codeName === "WriteConflict") {
        console.warn(`Retrying transaction (${attempt}/${maxRetries})`);
        continue;
      }

      throw err;
    }
  }

  throw lastError;
}
// @desc    Create a new stock reconciliation
// @route   POST /api/stockReconciliation
// @access  Private
exports.createStockReconciliation = asyncHandler(async (req, res) => {
  await runWithRetry(async () => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const companyId = req.query.companyId;
      if (!companyId) {
        return res.status(400).json({ message: "companyId is required" });
      }

      const { stockID, stockName, items, counter, title, isClosed } = req.body;
      if (!stockID || !items?.length) {
        return res.status(400).json({ message: "Invalid reconciliation data" });
      }
      const nextCounterForReconciliation =
        (await reconciliationModel.countDocuments({ companyId })) + 1;

      /* ===============================
         Create reconciliation document
         =============================== */
      const [reconciliation] = await reconciliationModel.create(
        [
          {
            companyId,
            title,
            isClosed,
            stockID,
            stockName,
            reconcilingDate: new Date(),
            employee: req.user.name,
            counter: Number(counter) + nextCounterForReconciliation,
            items,
          },
        ],
        { session }
      );

      /* ===============================
         Apply stock quantity updates
         =============================== */
      const bulkOps = [];

      for (const item of items) {
        if (!item.reconciled || !item.difference) continue;

        bulkOps.push({
          updateOne: {
            filter: {
              _id: item.productId,
              companyId,
              "stocks.stockId": stockID,
            },
            update: {
              $inc: {
                "stocks.$.productQuantity": item.difference,
              },
              $set: {
                "stocks.$.stockName": stockName,
              },
            },
          },
        });
      }

      if (bulkOps.length) {
        const result = await productModel.bulkWrite(bulkOps, { session });

        if (result.matchedCount !== bulkOps.length) {
          throw new Error("Some products do not exist in the selected stock");
        }
      }

      /* ===============================
         Handle movements & FIFO
         =============================== */
      for (const item of items) {
        if (!item.reconciled || !item.difference) continue;

        const product = await productModel
          .findById(item.productId)
          .session(session);

        if (!product) throw new Error("Product not found");

        /* ===== INCREASE STOCK ===== */
        if (item.difference > 0) {
          await createProductMovement(
            {
              productId: item.productId,
              reference: reconciliation._id,
              newQuantity: item.recordCount + item.difference,
              quantity: item.difference,
              movementType: item.movementType,
              source: "Stock reconciliation",
              companyId,
              enterPrice: product.costBuyingPrice,
              stockId: stockID,
            },
            session
          );

          await createProductBatch(
            {
              productId: item.productId,
              companyId,
              stockId: stockID,
              quantity: item.difference,
              buyingprice: product.costBuyingPrice,
              sourceId: reconciliation._id,
              costBuyingPrice: product.costBuyingPrice,
              referenceType: "Stock Reconciliation",
            },
            session
          );
        } else {
          /* ===== DECREASE STOCK (FIFO) ===== */
          let qtyToDeduct = Math.abs(item.difference);

          const batches = await prodcutBatchModel
            .find({
              productId: item.productId,
              companyId,
              stockId: stockID,
              remaining: { $gt: 0 },
            })
            .sort({ createdAt: 1 })
            .session(session);

          for (const batch of batches) {
            if (qtyToDeduct <= 0) break;

            const usedQty = Math.min(batch.remaining, qtyToDeduct);

            batch.remaining -= usedQty;
            await batch.save({ session });

            qtyToDeduct -= usedQty;
            console.log("item", item);

            await createProductMovement(
              {
                productId: item.productId,
                reference: reconciliation._id,
                newQuantity: item.recordCount + item.difference,
                quantity: usedQty,
                movementType: item.movementType,
                source: "Stock reconciliation",
                companyId,
                outPrice: batch.costBuyingPrice,
                stockId: stockID,
              },
              session
            );
          }

          if (qtyToDeduct > 0) {
            throw new Error("Not enough stock for FIFO deduction");
          }

          /* ===== Recalculate Avg Cost ===== */
          const remainingBatches = await prodcutBatchModel
            .find({
              productId: item.productId,
              companyId,
              stockId: stockID,
              remaining: { $gt: 0 },
            })
            .session(session);

          let totalQty = 0;
          let totalCost = 0;

          for (const batch of remainingBatches) {
            totalQty += batch.remaining;
            totalCost += batch.remaining * batch.costBuyingPrice;
          }

          const newAvgCost = totalQty ? totalCost / totalQty : 0;

          await productModel.updateOne(
            { _id: item.productId },
            { $set: { costBuyingPrice: newAvgCost } },
            { session }
          );
        }
      }

      await session.commitTransaction();
      session.endSession();

      res.status(201).json({
        success: true,
        data: reconciliation,
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  });
});

// @desc    Get all reconciliation
// @route   GET /api/stockReconciliation
// @access  Private
exports.findAllReconciliations = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const pageSize = req.query.limit || 0;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * pageSize;

  let query = { companyId };
  if (req.query.keyword) {
    query.$or = [
      { title: { $regex: req.query.keyword, $options: "i" } },
      { stockName: { $regex: req.query.keyword, $options: "i" } },
      { employee: { $regex: req.query.keyword, $options: "i" } },
    ];
  }
  const totalItems = await reconciliationModel.countDocuments(query);

  // Calculate total pages
  const totalPages = Math.ceil(totalItems / pageSize);
  const mongooseQuery = reconciliationModel
    .find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(pageSize);
  const reconciliation = await mongooseQuery;
  if (!reconciliation) {
    return next(new ApiError(`Couldn't get the reports`, 404));
  }

  res.status(200).json({
    status: "true",
    results: reconciliation.length,
    data: reconciliation,
    Pages: totalPages,
  });
});

// @desc    Get one reconciliation report by ID
// @route   GET /api/stockReconciliation/:id
// @access  Private
exports.findReconciliationReport = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const { id } = req.params;
  const reconciliation = await reconciliationModel
    .findOne({ _id: id, companyId })
    .sort({ createdAt: -1 });
  if (!reconciliation) {
    return next(
      new ApiError(`No reconciliation record for this id ${id}`, 404)
    );
  }
  res.status(200).json({ status: "true", data: reconciliation });
});

// @desc    Get one reconciliation report by ID
// @route   GET /api/stockReconciliation/:id/edit
// @access  Private
exports.updataOneReconciliationReport = asyncHandler(async (req, res) => {
  await runWithRetry(async () => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const companyId = req.query.companyId;
      const reconciliationId = req.params.id;

      if (!companyId) {
        return res.status(400).json({ message: "companyId is required" });
      }

      /* ===============================
         1️⃣ Load existing reconciliation
         =============================== */
      const oldReconciliation = await reconciliationModel
        .findOne({ _id: reconciliationId, companyId })
        .session(session);

      if (!oldReconciliation) {
        return res.status(404).json({ message: "Reconciliation not found" });
      }

      const { items, stockID, stockName } = req.body;

      /* ===============================
         2️⃣ Detect newly reconciled items
         =============================== */
      const previouslyReconciled = new Set(
        oldReconciliation.items
          .filter((i) => i.reconciled)
          .map((i) => String(i.productId))
      );

      const newlyReconciledItems = items.filter(
        (item) =>
          item.reconciled &&
          item.difference &&
          !previouslyReconciled.has(String(item.productId))
      );

      /* ===============================
         3️⃣ Apply stock quantity updates
         =============================== */
      const bulkOps = [];

      for (const item of newlyReconciledItems) {
        bulkOps.push({
          updateOne: {
            filter: {
              _id: item.productId,
              companyId,
              "stocks.stockId": stockID,
            },
            update: {
              $inc: {
                "stocks.$.productQuantity": item.difference,
              },
              $set: {
                "stocks.$.stockName": stockName,
              },
            },
          },
        });
      }

      if (bulkOps.length) {
        const result = await productModel.bulkWrite(bulkOps, { session });

        if (result.matchedCount !== bulkOps.length) {
          throw new Error("Some products do not exist in the selected stock");
        }
      }

      /* ===============================
         4️⃣ Movements & FIFO handling
         =============================== */
      for (const item of newlyReconciledItems) {
        const product = await productModel
          .findById(item.productId)
          .session(session);

        if (!product) throw new Error("Product not found");
        console.log(item);
        /* ===== INCREASE STOCK ===== */
        if (item.difference > 0) {
          await createProductMovement(
            {
              productId: item.productId,
              reference: reconciliationId,
              newQuantity: item.recordCount + item.difference,
              quantity: item.difference,
              movementType: item.movementType,
              source: "Stock reconciliation",
              companyId,
              enterPrice: product.costBuyingPrice,
              stockId: stockID,
            },
            session
          );

          await createProductBatch(
            {
              productId: item.productId,
              companyId,
              stockId: stockID,
              quantity: item.difference,
              buyingprice: product.costBuyingPrice,
              sourceId: reconciliationId,
              costBuyingPrice: product.costBuyingPrice,
              referenceType: "Stock Reconciliation",
            },
            session
          );
        } else {
          /* ===== DECREASE STOCK (FIFO) ===== */
          let qtyToDeduct = Math.abs(item.difference);

          const batches = await prodcutBatchModel
            .find({
              productId: item.productId,
              companyId,
              stockId: stockID,
              remaining: { $gt: 0 },
            })
            .sort({ createdAt: 1 })
            .session(session);

          for (const batch of batches) {
            if (qtyToDeduct <= 0) break;

            const usedQty = Math.min(batch.remaining, qtyToDeduct);
            batch.remaining -= usedQty;
            await batch.save({ session });

            qtyToDeduct -= usedQty;

            await createProductMovement(
              {
                productId: item.productId,
                reference: reconciliationId,
                newQuantity: item.recordCount + item.difference,
                quantity: usedQty,
                movementType: item.movementType,
                source: "Stock reconciliation",
                companyId,
                outPrice: batch.costBuyingPrice,
                stockId: stockID,
              },
              session
            );
          }

          if (qtyToDeduct > 0) {
            throw new Error("Not enough stock for FIFO deduction");
          }

          /* ===== Recalculate Avg Cost ===== */
          const remainingBatches = await prodcutBatchModel
            .find({
              productId: item.productId,
              companyId,
              stockId: stockID,
              remaining: { $gt: 0 },
            })
            .session(session);

          let totalQty = 0;
          let totalCost = 0;

          for (const batch of remainingBatches) {
            totalQty += batch.remaining;
            totalCost += batch.remaining * batch.costBuyingPrice;
          }

          const newAvgCost = totalQty ? totalCost / totalQty : 0;

          await productModel.updateOne(
            { _id: item.productId },
            { $set: { costBuyingPrice: newAvgCost } },
            { session }
          );
        }
      }

      /* ===============================
         5️⃣ Update reconciliation document
         =============================== */
      const updatedReconciliation = await reconciliationModel.findOneAndUpdate(
        { _id: reconciliationId, companyId },
        req.body,
        { new: true, session }
      );

      await session.commitTransaction();
      session.endSession();

      res.status(200).json({
        success: true,
        data: updatedReconciliation,
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  });
});
