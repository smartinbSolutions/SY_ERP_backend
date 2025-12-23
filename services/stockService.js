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
        (s) => s.stockId.toString() === stockId
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
    }
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
exports.transformQuantity = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  // Validate companyId
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  req.body.companyId = companyId;

  const { fromStockId, toStockId, products, counter } = req.body;

  // Fetch both stocks
  const stocks = await StockModel.find({
    _id: { $in: [fromStockId, toStockId] },
    companyId,
  });
  const fromStock = stocks.find((s) => s._id.toString() === fromStockId);
  const toStock = stocks.find((s) => s._id.toString() === toStockId);

  if (!fromStock || !toStock) {
    return res.status(404).json({ message: "Stock not found" });
  }

  // Validate product quantities
  for (const product of products) {
    const quantity = parseInt(product.productQuantity, 10);
    if (quantity < 0) {
      return res
        .status(400)
        .json({ message: "Product quantity cannot be less than 0" });
    }
  }

  // Generate transfer counter
  const nextCounterForTransfer =
    (await stockTransferModel.countDocuments({ companyId })) + 1;

  // Create the stock transfer record
  const transferStock = await stockTransferModel.create({
    ...req.body,
    counter: Number(counter) + nextCounterForTransfer,
  });
  const transferId = transferStock._id;

  // Prepare bulk operations for product updates
  const bulkOps = [];

  for (const product of products) {
    const { productId, productQuantity } = product;
    const quantity = parseInt(productQuantity, 10);

    const productDoc = await productModel.findById(productId);

    // Check if fromStock and toStock exist in the product
    const fromStockExists = productDoc.stocks.some(
      (stock) => stock.stockId.toString() === fromStockId
    );
    const toStockExists = productDoc.stocks.some(
      (stock) => stock.stockId.toString() === toStockId
    );

    // Deduct quantity from fromStock
    if (fromStockExists) {
      bulkOps.push({
        updateOne: {
          filter: { _id: productId, "stocks.stockId": fromStockId },
          update: { $inc: { "stocks.$.productQuantity": -quantity } },
        },
      });
    } else {
      return res.status(400).json({
        message: `Stock ID ${fromStockId} not found in product ${productId}`,
      });
    }

    // Add quantity to toStock
    if (toStockExists) {
      bulkOps.push({
        updateOne: {
          filter: { _id: productId, "stocks.stockId": toStockId },
          update: { $inc: { "stocks.$.productQuantity": quantity } },
        },
      });
    } else {
      // If toStock doesn't exist, add it
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

    // Calculate total quantity across all stocks for movement record
    const totalProductQuantity = productDoc.stocks.reduce((sum, stock) => {
      const qty = parseInt(stock.productQuantity, 10);
      return sum + (isNaN(qty) ? 0 : qty);
    }, 0);

    // Create OUT movement from fromStock
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
    });

    // Create IN movement to toStock
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
    });
  }

  // Execute bulk updates
  await productModel.bulkWrite(bulkOps);

  // Update shortages if any selected
  if (req.body?.selectedId?.length > 0) {
    await ShortageModel.updateMany(
      { _id: { $in: req.body.selectedId } },
      { status: "done" }
    );
  }

  res.status(200).json({
    status: "success",
    message: "Transfer successful",
    data: transferStock,
  });
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
