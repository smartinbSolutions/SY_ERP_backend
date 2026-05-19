const asyncHandler = require("express-async-handler");

const { createProductMovement } = require("../utils/productMovement");
const StockModel = require("../models/stockModel");
const { default: slugify } = require("slugify");
const ApiError = require("../utils/apiError");
const productModel = require("../models/productModel");
const stockTransferModel = require("../models/stockTransfer");
const productMovementModel = require("../models/productMovementModel");
const ShortageModel = require("../models/ShortageModel");
const { default: mongoose } = require("mongoose");
const { createProductBatch } = require("./productBatchServices");
const prodcutBatchModel = require("../models/Stocks/products/prodcutBatchModel");

exports.createStock = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  req.body.companyId = companyId;
  req.body.slug = slugify(req.body.name);
  const Stock = await StockModel.create(req.body);
  res.status(200).json({
    status: "success",
    message: "Stock created successfully",
    data: Stock,
  });
});

exports.getStocks = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  let query = { companyId };

  if (req.query.keyword) {
    query.$or = [
      { name: { $regex: req.query.keyword, $options: "i" } },
      { location: { $regex: req.query.keyword, $options: "i" } },
    ];
  }
  const Stocks = await StockModel.find(query);
  res
    .status(200)
    .json({ statusbar: "success", results: Stocks.length, data: Stocks });
});

exports.getOneStock = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const stockId = req.params.id;
  const stock = await StockModel.findOne({ _id: stockId, companyId });

  if (!stock) {
    return next(new ApiError(`No stock found for id ${stockId}`, 404));
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const pricingMethod = req.query.pricingMethod;
  const calculate = req.query.calculate === "true";

  let query = {
    "stocks.stockId": stockId,
    companyId,
    "stocks.productQuantity": { $gt: 0 },
  };

  if (req.query.categoryId) query.category = req.query.categoryId;
  if (req.query.brandId) query.brand = req.query.brandId;

  if (pricingMethod) {
    query["unitsPrices.prices.title"] = pricingMethod;
  }

  if (req.query.keyword) {
    query.$or = [
      { name: { $regex: req.query.keyword, $options: "i" } },
      { qr: { $regex: req.query.keyword, $options: "i" } },
    ];
  }

  const totalProducts = await productModel.countDocuments(query);
  const totalPages = Math.ceil(totalProducts / limit);

  let products = await productModel
    .find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("unit")
    .populate("currency");

  let filteredProducts = products
    .map((product) => {
      const filteredStocks = product.stocks.filter(
        (s) => s.stockId.toString() === stockId,
      );
      return {
        ...product._doc,
        stocks: filteredStocks,
      };
    })
    .filter((product) => product.stocks.length > 0);

  let totalForMethod = 0;

  // Apply calculation if requested
  if (calculate && pricingMethod) {
    filteredProducts = filteredProducts.map((product, index) => {
      const units = product.unitsPrices || [];

      const unitsWithCalculation = units.map((unit, unitIndex) => {
        const priceObj = unit?.prices?.find((p) => p.title === pricingMethod);
        const methodPrice = priceObj ? Number(priceObj.price) : 0;
        const qty = Number(product.stocks[0]?.productQuantity || 0);
        const totalProductPrice = methodPrice * qty;
        totalForMethod += totalProductPrice;
        return {
          ...unit,
          unitPrice: methodPrice,
          totalUnitPrice: totalProductPrice,
        };
      });

      return {
        ...product,
        unitsPrices: unitsWithCalculation,
      };
    });
  }

  res.status(200).json({
    status: "success",
    results: totalProducts,
    totalProducts,
    pages: totalPages,
    data: {
      stock,
      products: filteredProducts,
      totalMethodPrice: calculate ? totalForMethod : undefined,
      pricingMethod,
    },
  });
});

exports.updateStock = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  req.body.slug = slugify(req.body.name);
  const Stock = await StockModel.findOneAndUpdate(
    { _id: req.params.id, companyId },
    req.body,
    {
      new: true,
    },
  );
  if (!Stock) {
    return next(new ApiError(`No Stock found for id ${req.params.id}`, 404));
  }
  res.status(200).json({
    status: "success",
    data: Stock,
  });
});

exports.deleteStock = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const Stock = await StockModel.findOneAndDelete({
    _id: req.params.id,
    companyId,
  });
  if (!Stock) {
    return next(new ApiError(`No Stock found for id ${req.params.id}`, 404));
  }
  res.status(200).json({
    status: "success",
    message: "Stock Delete successfully",
  });
});

// @desc    Transfer product quantities between stocks
// @route   PUT /api/stock/transfer
// @access  Private
exports.transformQuantity = asyncHandler(async (req, res) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  req.body.companyId = companyId;

  const {
    fromStockId,
    toStockId,
    products = [],
    counter = 0,
    selectedId = [],
  } = req.body;

  if (!fromStockId || !toStockId) {
    return res
      .status(400)
      .json({ message: "fromStockId and toStockId are required" });
  }

  if (!Array.isArray(products) || products.length === 0) {
    return res
      .status(400)
      .json({ message: "products must be a non-empty array" });
  }

  // Validate quantities
  for (const p of products) {
    const q = Number(p?.productQuantity);
    if (!p?.productId) {
      return res
        .status(400)
        .json({ message: "productId is required for each item" });
    }
    if (!Number.isFinite(q) || q <= 0) {
      return res
        .status(400)
        .json({ message: "productQuantity must be a number > 0" });
    }
  }

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      // Fetch stocks
      const stocks = await StockModel.find({
        _id: { $in: [fromStockId, toStockId] },
        companyId,
      }).session(session);

      const fromStock = stocks.find(
        (s) => s._id.toString() === String(fromStockId),
      );
      const toStock = stocks.find(
        (s) => s._id.toString() === String(toStockId),
      );

      if (!fromStock || !toStock) {
        throw Object.assign(new Error("Stock not found"), { statusCode: 404 });
      }

      // Generate transfer counter
      const nextCounterForTransfer =
        (await stockTransferModel
          .countDocuments({ companyId })
          .session(session)) + 1;

      // Create transfer record
      const transferStock = await stockTransferModel.create(
        [
          {
            ...req.body,
            companyId,
            counter: Number(counter) + nextCounterForTransfer,
          },
        ],
        { session },
      );

      const transferDoc = transferStock[0];
      const transferId = transferDoc._id;

      // Prepare bulk ops
      const bulkOps = [];

      for (const p of products) {
        const productId = p.productId;
        const quantity = Number(p.productQuantity);

        const productDoc = await productModel
          .findOne({ _id: productId, companyId })
          .session(session);

        if (!productDoc) {
          throw Object.assign(new Error(`Product not found: ${productId}`), {
            statusCode: 404,
          });
        }

        const stocksArr = Array.isArray(productDoc.stocks)
          ? productDoc.stocks
          : [];

        // Ensure from stock exists in product
        const fromStockExists = stocksArr.some(
          (st) => st?.stockId?.toString() === String(fromStockId),
        );
        if (!fromStockExists) {
          throw Object.assign(
            new Error(
              `Stock ID ${fromStockId} not found in product ${productId}`,
            ),
            { statusCode: 400 },
          );
        }

        // Prevent negative quantity in fromStock
        const fromEntry = stocksArr.find(
          (st) => st?.stockId?.toString() === String(fromStockId),
        );
        const fromQty = Number(fromEntry?.productQuantity) || 0;
        if (fromQty < quantity) {
          throw Object.assign(
            new Error(
              `Not enough quantity in fromStock for product ${productId}. Available=${fromQty}, Requested=${quantity}`,
            ),
            { statusCode: 400 },
          );
        }

        // Bulk: decrement fromStock
        bulkOps.push({
          updateOne: {
            filter: {
              _id: productId,
              companyId,
              "stocks.stockId": fromStockId,
            },
            update: { $inc: { "stocks.$.productQuantity": -quantity } },
          },
        });

        // Bulk: increment toStock or push if missing
        const toStockExists = stocksArr.some(
          (st) => st?.stockId?.toString() === String(toStockId),
        );

        if (toStockExists) {
          bulkOps.push({
            updateOne: {
              filter: {
                _id: productId,
                companyId,
                "stocks.stockId": toStockId,
              },
              update: { $inc: { "stocks.$.productQuantity": quantity } },
            },
          });
        } else {
          bulkOps.push({
            updateOne: {
              filter: { _id: productId, companyId },
              update: {
                $push: {
                  stocks: {
                    stockId: toStockId,
                    stockName: toStock.name,
                    productQuantity: quantity,
                  },
                },
              },
            },
          });
        }

        // Total across all stocks (transfer doesn't change total)
        const totalProductQuantity = stocksArr.reduce((sum, st) => {
          const qty = Number(st?.productQuantity);
          return sum + (Number.isFinite(qty) ? qty : 0);
        }, 0);

        // OUT movement (fromStock)
        await createProductMovement({
          productId,
          reference: transferId,
          newQuantity: totalProductQuantity,
          quantity,
          movementType: "out",
          source: "Stock Transfer",
          companyId,
          desc: `${fromStock.name} -> ${toStock.name}`,
          stockId: fromStockId,
          outPrice: p.buyingPrice,
        });

        // FIFO batches: remove from source batches
        let qtyToOut = quantity;
        const fifoMovements = [];

        const batches = await prodcutBatchModel
          .find({
            productId,
            companyId,
            stockId: fromStockId,
            remaining: { $gt: 0 },
          })
          .sort({ createdAt: 1 })
          .session(session);

        for (const batch of batches) {
          if (qtyToOut <= 0) break;

          const remaining = Number(batch.remaining) || 0;
          const usedQty = Math.min(remaining, qtyToOut);

          if (usedQty <= 0) continue;

          batch.remaining = remaining - usedQty;
          await batch.save({ session });

          qtyToOut -= usedQty;

          fifoMovements.push({
            quantity: usedQty,
            buyingprice: batch.buyingprice,
            costBuyingPrice: batch.costBuyingPrice,
            exchangeRate: batch.exchangeRate,
            sourceBatchId: batch._id,
          });
        }

        if (qtyToOut > 0) {
          throw Object.assign(new Error("Not enough batch stock"), {
            statusCode: 400,
          });
        }

        // IN movement (toStock)
        await createProductMovement({
          productId,
          reference: transferId,
          newQuantity: totalProductQuantity,
          quantity,
          movementType: "in",
          source: "Stock Transfer",
          companyId,
          desc: `${fromStock.name} -> ${toStock.name}`,
          stockId: toStockId,
          enterPrice: p.buyingPrice,
        });

        // ✅ Create ONE destination batch only (weighted average from FIFO consumption)
        let totalMovedQty = 0;
        let totalBuyingValue = 0;
        let totalCostValue = 0;
        let totalExchangeValue = 0;

        for (const m of fifoMovements) {
          const q = Number(m.quantity) || 0;
          totalMovedQty += q;

          const bp = Number(m.buyingprice) || 0;
          const cbp = Number(m.costBuyingPrice) || 0;
          const ex = Number(m.exchangeRate) || 0;

          totalBuyingValue = bp;
          totalCostValue = cbp;
          totalExchangeValue = ex;
        }

        if (totalMovedQty <= 0) {
          throw Object.assign(new Error("No FIFO movements were created"), {
            statusCode: 400,
          });
        }

        // Optional strict check (use tolerance if you have decimals)
        if (Math.abs(totalMovedQty - quantity) > 1e-9) {
          throw Object.assign(
            new Error(
              `FIFO moved qty mismatch. Moved=${totalMovedQty}, Requested=${quantity}`,
            ),
            { statusCode: 400 },
          );
        }

        const avgBuyingPrice = totalBuyingValue;
        const avgCostBuyingPrice = totalCostValue;
        const avgExchangeRate = totalExchangeValue;

        await createProductBatch({
          productId,
          companyId,
          stockId: toStockId,
          quantity: totalMovedQty,
          buyingprice: avgBuyingPrice,
          costBuyingPrice: avgCostBuyingPrice,
          exchangeRate: avgExchangeRate,
          sourceId: transferId,
          sourceType: "stock_transfer",
          meta: {
            fromStockId,
            toStockId,
            fifoSources: fifoMovements.map((x) => ({
              batchId: x.sourceBatchId,
              quantity: x.quantity,
            })),
          },
        });
      }

      // Execute bulk updates
      if (bulkOps.length) {
        await productModel.bulkWrite(bulkOps, { session });
      }

      // Update shortages if selected
      if (Array.isArray(selectedId) && selectedId.length > 0) {
        await ShortageModel.updateMany(
          { _id: { $in: selectedId }, companyId },
          { status: "done" },
          { session },
        );
      }

      res.status(200).json({
        status: "success",
        message: "Transfer successful",
        data: transferDoc,
      });
    });
  } catch (err) {
    const code = err?.statusCode || 500;
    return res.status(code).json({
      status: "fail",
      message: err?.message || "Internal Server Error",
    });
  } finally {
    await session.endSession();
  }
});

// @desc put list product
// @route put /api/stock/transfer
// @access Private

exports.getTransferStock = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const pageSize = req.query.limit || 10;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * pageSize;

  let query = { companyId };

  if (req.query.keyword) {
    query.$or = [
      { name: { $regex: req.query.keyword, $options: "i" } },
      { date: { $regex: req.query.keyword, $options: "i" } },
    ];
  }
  const totalItems = await stockTransferModel.countDocuments(query);

  const totalPages = Math.ceil(totalItems / pageSize);

  const transfer = await stockTransferModel
    .find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(pageSize);

  res.status(200).json({
    statusbar: "success",
    results: transfer.length,
    Pages: totalPages,
    data: transfer,
  });
});

exports.getTransferForStock = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const pageSize = req.query.limit || 10;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * pageSize;
  const { id } = req.params;

  let query = {
    $or: [{ toStockId: id }, { fromStockId: id }],
    companyId,
  };

  if (req.query.keyword) {
    query.$or = [
      { fromStock: { $regex: req.query.keyword, $options: "i" } },
      { toStock: { $regex: req.query.keyword, $options: "i" } },
      { sender: { $regex: req.query.keyword, $options: "i" } },
      { recipient: { $regex: req.query.keyword, $options: "i" } },
    ];
  }

  const totalItems = await stockTransferModel.countDocuments(query);
  const totalPages = Math.ceil(totalItems / pageSize);
  const transfer = await stockTransferModel
    .find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(pageSize);

  res.status(200).json({
    statusbar: "success",
    results: transfer.length,
    Pages: totalPages,
    data: transfer,
  });
});

exports.getAllStatementStock = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const pageSize = req.query.limit || 10;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * pageSize;

  let query = { companyId };

  if (req.query.keyword) {
    query.$or = [
      { fromStock: { $regex: req.query.keyword, $options: "i" } },
      { toStock: { $regex: req.query.keyword, $options: "i" } },
      { sender: { $regex: req.query.keyword, $options: "i" } },
      { recipient: { $regex: req.query.keyword, $options: "i" } },
    ];
  }

  const totalItems = await stockTransferModel.countDocuments(query);
  const totalPages = Math.ceil(totalItems / pageSize);
  const transfer = await stockTransferModel
    .find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(pageSize);

  res.status(200).json({
    statusbar: "success",
    results: transfer.length,
    Pages: totalPages,
    data: transfer,
  });
});

exports.getOneTransferStock = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const { id } = req.params;
  const transfer = await stockTransferModel.findOne({ _id: id, companyId });

  res.status(200).json({ statusbar: "success", data: transfer });
});

exports.getStocksProducts = asyncHandler(async (req, res) => {
  const {
    companyId,
    stockId,
    startDate,
    endDate,
    category,
    page = 1,
    limit = 20,
  } = req.query;

  const pageNumber = parseInt(page);
  const pageLimit = parseInt(limit);

  const matchProduct = { companyId };
  if (category) matchProduct.category = category;

  const productsWithStats = await productModel.aggregate([
    { $match: matchProduct },

    {
      $lookup: {
        from: "categories",
        localField: "category",
        foreignField: "_id",
        as: "categoryInfo",
      },
    },
    { $unwind: { path: "$categoryInfo", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        categoryInfo: {
          _id: "$categoryInfo._id",
          name: "$categoryInfo.name",
        },
      },
    },

    {
      $lookup: {
        from: "productmovements",
        let: { productId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$productId", "$$productId"] },
                  ...(stockId
                    ? [
                        {
                          $eq: [
                            "$stockId",
                            new mongoose.Types.ObjectId(stockId),
                          ],
                        },
                      ]
                    : []),
                  ...(startDate
                    ? [
                        {
                          $gte: [
                            "$createdAt",
                            new Date(startDate + "T00:00:00.000Z"),
                          ],
                        },
                      ]
                    : []),
                  ...(endDate
                    ? [
                        {
                          $lte: [
                            "$createdAt",
                            new Date(endDate + "T23:59:59.999Z"),
                          ],
                        },
                      ]
                    : []),
                ],
              },
            },
          },
          {
            $group: {
              _id: { productId: "$productId", stockId: "$stockId" },
              totalQuantity: { $sum: { $toDouble: "$quantity" } },
              totalCost: {
                $sum: {
                  $multiply: [
                    { $toDouble: "$enterPrice" },
                    { $toDouble: "$quantity" },
                  ],
                },
              },
              sumPrices: { $sum: { $toDouble: "$enterPrice" } },
              countPrices: { $sum: 1 },
            },
          },
          {
            $project: {
              stockId: "$_id.stockId",
              totalQuantity: 1,
              totalCost: 1,
              averagePrice: { $divide: ["$sumPrices", "$countPrices"] },
            },
          },
        ],
        as: "movements",
      },
    },

    { $unwind: "$movements" },

    {
      $addFields: {
        totalQuantity: "$movements.totalQuantity",
        averageBuyingPrice: {
          $cond: [
            { $eq: ["$movements.totalQuantity", 0] },
            0,
            { $divide: ["$movements.totalCost", "$movements.totalQuantity"] },
          ],
        },
        averageEnterPrice: "$movements.averagePrice",
        stockId: "$movements.stockId",
      },
    },

    { $match: { totalQuantity: { $gt: 0 } } },

    { $project: { movements: 0 } },

    { $skip: (pageNumber - 1) * pageLimit },
    { $limit: pageLimit },
  ]);

  const totalProducts = await productModel.countDocuments(matchProduct);
  const totalPages = Math.ceil(totalProducts / pageLimit);

  res.json({
    data: productsWithStats,
    pages: pageNumber,
    limit: pageLimit,
    totalProducts,
    totalPages,
  });
});
