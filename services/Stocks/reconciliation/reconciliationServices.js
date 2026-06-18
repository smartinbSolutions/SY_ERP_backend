const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const reconciliationModel = require("../../../models/Stocks/reconciliation/reconciliationModel");
const reconciliationItemModel = require("../../../models/Stocks/reconciliation/reconciliationItemModel");
const { getIo } = require("../../../utils/socket");
const ApiError = require("../../../utils/apiError");
const productModel = require("../../../models/Stocks/products/productModel");
const { createProductBatch } = require("../../productBatchServices");
const { createProductMovement } = require("../../../utils/productMovement");
const counterModel = require("../../../models/Settings/counterModel");

// Create a new reconciliation report
exports.createStockReconciliation = asyncHandler(async (req, res) => {
  const companyId = req.companyId;

  if (!companyId)
    return res.status(400).json({ message: "companyId is required" });

  const {
    title,
    stockId,
    stockName,
    reconciliationType,
    reconcilingDate,
    counter,
  } = req.body;

  if (!title || !stockId || !reconciliationType) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  // ✅ Prevent multiple active reports for the same stock
  const active = await reconciliationModel.findOne({
    companyId,
    stockId,
    status: { $in: ["DRAFT", "SUBMITTING"] },
  });

  if (active) {
    return res.status(409).json({
      message:
        "There is already an active reconciliation report for this stock.",
      data: { id: active._id, status: active.status, title: active.title },
    });
  }

  let date = reconcilingDate;
  if (!date) {
    const now = new Date();
    const pad = (v) => (v < 10 ? `0${v}` : v);
    date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate()
    )} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(
      now.getSeconds()
    )}`;
  }

  const ReportCounter = await counterModel.findOneAndUpdate(
    { companyId, name: "stockReconciliation" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  try {
    const reconciliation = await reconciliationModel.create({
      title,
      counter: counter + ReportCounter.seq,
      reconcilingDate: date,
      reconciliationType,
      stockId,
      stockName,
      companyId,
      employee: req.user.name,
      createdBy: req.user.id,
      status: "DRAFT",
    });

    return res.status(201).json({ success: true, data: reconciliation });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        message: "FIRST_TIME reconciliation already exists for this stock",
      });
    }
    throw err;
  }
});
// Upsert a reconciliation item
exports.upsertReconciliationItem = asyncHandler(async (req, res, next) => {
  try {
    const companyId = req.companyId;
    const {
      reconciliationId,
      productId,
      realCount = 0,
      recordCount = 0,
      lossValue = 0,
      reconciled = false,
      reconcilingReason = "",
      productName,
      priceSnapshot,
    } = req.body;

    if (!companyId || !reconciliationId || !productId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const reconciliation = await reconciliationModel.findOne({
      _id: reconciliationId,
      companyId,
    });

    if (!reconciliation) {
      return next(new ApiError("Can't Add", 400));
    }

    // 🔒 RECONCILED LOCK
    const existingItem = await reconciliationItemModel.findOne({
      reconciliationId,
      productId,
      companyId,
    });

    if (
      reconciliation.status === "CLOSED" &&
      existingItem?.reconciled === true
    ) {
      return next(
        new ApiError(
          "This item is already reconciled and cannot be updated",
          409
        )
      );
    }

    const difference = realCount - recordCount;

    const item = await reconciliationItemModel.findOneAndUpdate(
      { reconciliationId, productId, companyId },
      {
        $set: {
          realCount,
          recordCount,
          difference,
          lossValue,
          reconciled,
          reconcilingReason,
          productName,
          priceSnapshot,
        },
        $setOnInsert: {
          reconciliationId,
          productId,
          companyId,
        },
      },
      { new: true, upsert: true }
    );

    getIo().to(`report:${reconciliationId}`).emit("itemUpdated", item);

    res.status(200).json({ success: true, data: item });
  } catch (err) {
    console.error("Error in upsertReconciliationItem:", err);
    res.status(500).json({
      message: "Internal server error",
      error: err.message,
    });
  }
});
// @desc    Get reconciliation items with pagination
// @route   GET /api/reconciliation/items
// @access  Private
exports.getReconciliationItems = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const reconciliationId = req.query.reconciliationId;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;

  if (!companyId || !reconciliationId) {
    return res
      .status(400)
      .json({ message: "companyId and reconciliationId are required" });
  }

  const skip = (page - 1) * limit;

  const filter = {
    reconciliationId,
    companyId,
    reconciled: false,
  };

  const totalItems = await reconciliationItemModel.countDocuments(filter);

  const items = await reconciliationItemModel
    .find(filter)
    .sort({ createdAt: 1 })
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    success: true,
    data: items,
    page,
    limit,
    totalItems,
    totalPages: Math.ceil(totalItems / limit),
  });
});

exports.getReconciliationItemsViewVersion = asyncHandler(async (req, res) => {
  const { reconciliationId, search = "" } = req.query;
  const companyId = req.companyId;

  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.max(parseInt(req.query.limit) || 50, 1);
  const skip = (page - 1) * limit;

  if (!companyId || !reconciliationId) {
    return res.status(400).json({
      message: "companyId and reconciliationId are required",
    });
  }

  const reconciliationObjectId = new mongoose.Types.ObjectId(reconciliationId);
  const searchText = search.trim();

  const pipeline = [
    /* =========================
       BASE MATCH
    ========================== */
    {
      $match: {
        companyId,
        reconciliationId: reconciliationObjectId,
      },
    },

    /* =========================
       PRODUCT LOOKUP
    ========================== */
    {
      $lookup: {
        from: "products",
        localField: "productId",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: "$product" },

    /* =========================
       🔍 SEARCH (NAME OR QR)
    ========================== */
    ...(searchText
      ? [
          {
            $match: {
              $or: [
                {
                  "product.name": {
                    $regex: searchText,
                    $options: "i",
                  },
                },
                {
                  "product.qr": {
                    $elemMatch: {
                      $regex: searchText,
                      $options: "i",
                    },
                  },
                },
              ],
            },
          },
        ]
      : []),

    /* =========================
       UNIT LOOKUP
    ========================== */
    {
      $lookup: {
        from: "units",
        localField: "product.unit",
        foreignField: "_id",
        as: "unit",
      },
    },
    { $unwind: { path: "$unit", preserveNullAndEmptyArrays: true } },

    /* =========================
       FINAL SHAPE
    ========================== */
    {
      $project: {
        _id: 1,
        reconciliationId: 1,
        productId: 1,

        productName: "$product.name",
        sku: "$product.sku",
        qr: "$product.qr",

        unitId: "$product.unit",
        unitName: "$unit.name",
        unitCode: "$unit.code",

        realCount: 1,
        recordCount: 1,
        difference: 1,
        reconciled: 1,
        reconcilingReason: 1,

        priceSnapshot: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },

    /* =========================
       PAGINATION
    ========================== */
    {
      $facet: {
        data: [
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
        ],
        meta: [{ $count: "totalItems" }],
      },
    },
  ];

  const result = await reconciliationItemModel.aggregate(pipeline);

  const items = result[0]?.data ?? [];
  const totalItems = result[0]?.meta[0]?.totalItems ?? 0;

  res.status(200).json({
    success: true,
    data: items,
    page,
    limit,
    totalItems,
    totalPages: Math.ceil(totalItems / limit),
  });
});
// Get all reconciliation reports
exports.getAllReconciliations = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  if (!companyId)
    return res.status(400).json({ message: "companyId is required" });

  const keyword = req.query.keyword || "";
  const limit = parseInt(req.query.limit) || 10;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * limit;

  let query = { companyId };
  if (keyword) {
    query.$or = [
      { title: { $regex: keyword, $options: "i" } },
      { stockName: { $regex: keyword, $options: "i" } },
      { employee: { $regex: keyword, $options: "i" } },
    ];
  }

  const totalItems = await reconciliationModel.countDocuments(query);
  const totalPages = Math.ceil(totalItems / limit);

  const reconciliations = await reconciliationModel
    .find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    success: true,
    data: reconciliations,
    results: reconciliations.length,
    totalPages,
    totalItems,
  });
});
// Get one reconciliation report by ID
exports.getReconciliationById = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId)
    return res.status(400).json({ message: "companyId is required" });
  if (!id)
    return res.status(400).json({ message: "Reconciliation ID is required" });

  const reconciliation = await reconciliationModel.findOne({
    _id: id,
    companyId,
  });
  if (!reconciliation)
    return res.status(404).json({ message: "Reconciliation not found" });

  res.status(200).json({ success: true, data: reconciliation });
});

exports.deleteReconciliationItem = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const { id } = req.params;
  const { productId } = req.query;

  if (!companyId)
    return res.status(400).json({ message: "company Id is required" });
  if (!id)
    return res.status(400).json({ message: "Reconciliation Id is required" });
  if (!productId)
    return res.status(400).json({ message: "product Id is required" });

  const item = await reconciliationItemModel.findOneAndDelete({
    reconciliationId: id,
    productId,
    companyId,
  });
  if (!item) return next(new ApiError(`No item for this id ${id}`, 404));

  res.status(203).json({ status: true, message: "item Deleted" });
});

exports.getOneItemForReconciliation = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const { id } = req.params;
  const { productId } = req.query;
  if (!companyId)
    return res.status(400).json({ message: "company Id is required" });
  if (!id)
    return res.status(400).json({ message: "Reconciliation Id is required" });
  if (!productId)
    return res.status(400).json({ message: "product Id is required" });

  const item = await reconciliationItemModel.findOne({
    reconciliationId: id,
    productId,
    companyId,
  });
  if (!item) return next(new ApiError(`No item for this id ${id}`, 404));
  res.status(200).json({ status: "true", item });
});

// exports.updataOneReconciliationReport = asyncHandler(async (req, res) => {
//   const companyId = req.companyId;
//   const { id } = req.params;

//   if (!companyId) {
//     return res.status(400).json({ message: "companyId is required" });
//   }

//   const reconciliation = await reconciliationModel.findOneAndUpdate(
//     { _id: id, companyId, status: "DRAFT" },
//     { status: "SUBMITTING" },
//     { new: true }
//   );

//   if (!reconciliation) {
//     return res.status(404).json({ message: "Reconciliation not found" });
//   }

//   const reconciliationItems = await reconciliationItemModel.find({
//     reconciliationId: id,
//     companyId,
//     reconciled: false,
//   });
//   try {
//     for (const item of reconciliationItems) {
//       const updatedProduct = await productModel.findOneAndUpdate(
//         {
//           _id: item.productId,
//           companyId,
//           "stocks.stockId": reconciliation.stockId,
//         },
//         {
//           $set: {
//             "stocks.$.stockName": reconciliation.stockName,
//             "stocks.$.productQuantity": item.realCount,
//           },
//         },
//         { new: true }
//       );

//       if (!updatedProduct) {
//         await productModel.findOneAndUpdate(
//           {
//             _id: item.productId,
//             companyId,
//           },
//           {
//             $push: {
//               stocks: {
//                 stockId: reconciliation.stockId,
//                 stockName: reconciliation.stockName,
//                 productQuantity: item.realCount,
//               },
//             },
//           }
//         );
//       }

//       const product = await productModel.findById(item.productId);

//       await createProductMovement({
//         productId: item.productId,
//         reference: id,
//         newQuantity: item.realCount,
//         quantity: item.difference,
//         movementType: item.difference > 0 ? "in" : "out",
//         source: "Stock reconciliation",
//         companyId,
//         enterPrice: product?.buyingprice || 0,
//         stockId: reconciliation.stockId,
//       });
//       if (item.difference > 0) {
//         await createProductBatch({
//           productId: item.productId,
//           companyId,
//           stockId: reconciliation.stockId,
//           quantity: item.difference,
//           buyingprice: product?.buyingprice || 0,
//           sourceId: id,
//           costBuyingPrice:
//             product?.costBuyingPrice || product?.buyingprice || 0,
//           referenceType: "Stock Reconciliation",
//         });
//       }
//     }
//     await reconciliationModel.findByIdAndUpdate(id, {
//       status: "CLOSED",
//     });
//   } catch (e) {
//     await reconciliationModel.findByIdAndUpdate(id, {
//       status: "DRAFT",
//     });
//     throw e;
//   }
//   res.status(200).json({
//     status: "success",
//     message: "Reconciliation completed successfully",
//   });
// });

exports.updataOneReconciliationReport = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      // 1) Move report to SUBMITTING (must be DRAFT)
      const reconciliation = await reconciliationModel.findOneAndUpdate(
        {
          _id: id,
          companyId,
          status: { $in: ["DRAFT", "CLOSED"] },
        },
        { status: "SUBMITTING" },
        { new: true, session }
      );
      if (!reconciliation) {
        // In a transaction, throw to abort
        const err = new Error("Reconciliation not found");
        err.statusCode = 404;
        throw err;
      }

      // 2) Fetch only unreconciled items
      const reconciliationItems = await reconciliationItemModel.find(
        { reconciliationId: id, companyId, reconciled: false },
        null,
        { session }
      );

      // Optional: if no items, you can decide to close or revert.
      // For now, it will simply close with no movements.
      for (const item of reconciliationItems) {
        // 3) Update product stock quantity in the selected stock
        const updatedProduct = await productModel.findOneAndUpdate(
          {
            _id: item.productId,
            companyId,
            "stocks.stockId": reconciliation.stockId,
          },
          {
            $set: {
              "stocks.$.stockName": reconciliation.stockName,
              "stocks.$.productQuantity": item.realCount,
            },
          },
          { new: true, session }
        );

        // If stock entry not found, push it
        if (!updatedProduct) {
          await productModel.findOneAndUpdate(
            { _id: item.productId, companyId },
            {
              $push: {
                stocks: {
                  stockId: reconciliation.stockId,
                  stockName: reconciliation.stockName,
                  productQuantity: item.realCount,
                },
              },
            },
            { session }
          );
        }

        // 4) Load product for pricing (same session)
        const product = await productModel.findById(item.productId, null, {
          session,
        });

        // 5) Create movement (MUST use session inside)
        await createProductMovement(
          {
            productId: item.productId,
            reference: id,
            newQuantity: item.realCount,
            quantity: item.difference,
            movementType: item.difference > 0 ? "in" : "out",
            source: "Stock reconciliation",
            companyId,
            enterPrice: product?.buyingprice || 0,
            stockId: reconciliation.stockId,
          },
          { session } // <-- pass session
        );

        // 6) Create batch only for positive adjustments (MUST use session inside)
        if (item.difference > 0) {
          await createProductBatch(
            {
              productId: item.productId,
              companyId,
              stockId: reconciliation.stockId,
              quantity: item.difference,
              buyingprice: product?.buyingprice || 0,
              sourceId: id,
              costBuyingPrice:
                product?.costBuyingPrice || product?.buyingprice || 0,
              sourceType: "Stock Reconciliation",
            },
            { session } // <-- pass session
          );
        }

        // 7) Mark item as reconciled AFTER effects succeeded
        await reconciliationItemModel.updateOne(
          { _id: item._id, companyId, reconciled: false },
          {
            $set: {
              reconciled: true,
              // optional but recommended for audit:
              reconciledAt: new Date(),
              // reconciledBy: req.user?._id
            },
          },
          { session }
        );
      }

      // 8) Finally close the report
      await reconciliationModel.updateOne(
        { _id: id, companyId },
        { $set: { status: "CLOSED" } },
        { session }
      );
    });

    // If we reach here, transaction committed
    return res.status(200).json({
      status: "success",
      message: "Reconciliation completed successfully",
    });
  } catch (e) {
    // No need to manually set DRAFT here; transaction aborts all changes automatically.
    // But if you want a fallback outside transaction for non-transaction errors, you can.
    const statusCode = e.statusCode || 500;
    return res.status(statusCode).json({
      status: "error",
      message: e.message || "Error while completing reconciliation",
    });
  } finally {
    session.endSession();
  }
});
