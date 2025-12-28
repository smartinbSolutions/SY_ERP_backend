const asyncHandler = require("express-async-handler");
const ProductMovement = require("../models/productMovementModel");
const { default: mongoose } = require("mongoose");
const productModel = require("../models/productModel");

// Get all products movement
exports.getAllProductsMovements = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const pageSize = parseInt(req.query.limit) || 0;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * pageSize;

  // Build the common filter stages
  const filterStages = [
    { $match: { type: "movement", companyId } },
    {
      $lookup: {
        from: "products",
        localField: "productId",
        foreignField: "_id",
        as: "productId",
      },
    },
    { $unwind: "$productId" },
  ];

  // Add keyword filter if present
  if (req.query.keyword) {
    filterStages.push({
      $match: {
        $or: [
          { movementType: { $regex: req.query.keyword, $options: "i" } },
          { source: { $regex: req.query.keyword, $options: "i" } },
          { "productId.name": { $regex: req.query.keyword, $options: "i" } },
        ],
      },
    });
  }

  try {
    // Fetch paginated movements
    const movements = await ProductMovement.aggregate([
      ...filterStages,
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: pageSize },
    ]);

    // Count total matching documents
    const countResult = await ProductMovement.aggregate([
      ...filterStages,
      { $count: "total" },
    ]);
    const totalItems = countResult.length > 0 ? countResult[0].total : 0;
    const totalPages = pageSize > 0 ? Math.ceil(totalItems / pageSize) : 1;

    res.status(200).json({
      status: "true",
      Pages: totalPages,
      results: movements.length,
      data: movements,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: `Error getting product movements: ${error.message}` });
  }
});

// Get product movement by ID
exports.getProductMovementByID = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const pageSize = req.query.limit || 10;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * pageSize;

  const query = { productId: id || "", companyId };
  const totalItems = await ProductMovement.countDocuments(query);
  const totalPages = Math.ceil(totalItems / pageSize);
  if (req.query.movementType) {
    query.movementType = req.query.movementType;
  }

  if (req.query.startDate && req.query.endDate) {
    const startDate = new Date(req.query.startDate);
    const endDate = new Date(req.query.endDate);

    if (!isNaN(startDate) && !isNaN(endDate)) {
      query.createdAt = {
        $gte: startDate,
        $lte: endDate,
      };
    } else {
      return res
        .status(400)
        .json({ status: "false", message: "Invalid date range" });
    }
  }

  let movements = [];
  if (id) {
    movements = await ProductMovement.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize);
  }

  res.status(200).json({
    status: "true",
    Pages: totalPages,
    results: movements.length,
    data: movements,
  });
});

exports.getHighestProductMovment = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const pageSize = parseInt(req.query.limit) || 10;
  const sort = req.query.sort;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * pageSize;

  const match = { companyId };

  if (req.query.startDate && req.query.endDate) {
    const startDate = new Date(req.query.startDate);
    const endDate = new Date(req.query.endDate);

    if (!isNaN(startDate) && !isNaN(endDate)) {
      match.createdAt = {
        $gte: startDate,
        $lte: endDate,
      };
    } else {
      return res
        .status(400)
        .json({ status: false, message: "Invalid date range" });
    }
  }

  let sortOption = { totalMovements: -1 };

  if (sort === "asc") {
    sortOption = { totalMovements: 1 };
  } else if (sort === "desc") {
    sortOption = { totalMovements: -1 };
  }

  // Aggregation pipeline
  const movements = await ProductMovement.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$productId",
        totalMovements: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "productInfo",
      },
    },
    { $unwind: "$productInfo" },
    { $sort: sortOption },
    { $skip: skip },
    { $limit: pageSize },
  ]);

  const totalItems = await ProductMovement.aggregate([
    { $match: match },
    { $group: { _id: "$productId" } },
    { $count: "count" },
  ]);

  res.status(200).json({
    status: true,
    data: movements.map((m) => ({
      productId: m._id,
      productName: m.productInfo.name,
      totalMovements: m.totalMovements,
    })),
    pagination: {
      totalItems: totalItems[0]?.count || 0,
      totalPages: Math.ceil((totalItems[0]?.count || 0) / pageSize),
      page,
      pageSize,
    },
  });
});

exports.getSalesReports = asyncHandler(async (req, res) => {
  const companyId = req.query.companyId;
  const idType = req.query.type || "product";
  const { startDate, endDate } = req.query;
  const { id } = req.params;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  let matchStage = { companyId };

  // Date filter
  if (startDate && endDate) {
    matchStage.createdAt = {
      $gte: new Date(startDate + "T00:00:00.000Z"),
      $lte: new Date(endDate + "T23:59:59.999Z"),
    };
  }

  let groupStage = {};
  let projectStage = {};

  if (idType === "product") {
    matchStage.productId = new mongoose.Types.ObjectId(id);

    const product = await productModel.findById(id).lean();
    const productName = product?.name || "";
    const costBuyingPrice = product?.costBuyingPrice || "";

    groupStage = {
      _id: "$productId",

      // Total buying value = price × quantity
      totalBuying: {
        $sum: {
          $cond: [
            { $eq: ["$movementType", "in"] },
            {
              $multiply: [
                { $toDouble: { $ifNull: ["$buyingPrice", 0] } },
                { $toDouble: { $ifNull: ["$quantity", 0] } },
              ],
            },
            0,
          ],
        },
      },

      // Total selling value
      totalSelling: {
        $sum: {
          $cond: [
            { $eq: ["$movementType", "out"] },
            {
              $multiply: [
                { $toDouble: { $ifNull: ["$sellingPrice", 0] } },
                { $toDouble: { $ifNull: ["$quantity", 0] } },
              ],
            },
            0,
          ],
        },
      },
      // Total quantities in/out
      totalQuantityIn: {
        $sum: {
          $cond: [{ $eq: ["$movementType", "in"] }, "$quantity", 0],
        },
      },
      totalQuantityOut: {
        $sum: {
          $cond: [{ $eq: ["$movementType", "out"] }, "$quantity", 0],
        },
      },
    };

    projectStage = {
      _id: 0,
      productId: "$_id",
      productName: productName,

      totalBuying: 1,
      totalSelling: 1,
      totalQuantityIn: 1,
      totalQuantityOut: 1,

      // ⭐ NEW: average buying price
      averageBuying: costBuyingPrice,
    };
  }

  // Category Mode
  else if (idType === "category") {
    const products = await productModel.find(
      { category: id, companyId },
      { _id: 1, name: 1 }
    );

    const ids = products.map((p) => p._id);

    if (ids.length === 0) {
      return res.status(200).json({
        status: "success",
        data: [],
      });
    }

    matchStage.productId = { $in: ids };

    groupStage = {
      _id: "$productId",

      totalBuying: {
        $sum: {
          $cond: [
            { $eq: ["$movementType", "in"] },
            {
              $multiply: [
                { $toDouble: { $ifNull: ["$buyingPrice", 0] } },
                { $toDouble: { $ifNull: ["$quantity", 0] } },
              ],
            },
            0,
          ],
        },
      },

      // Total selling value
      totalSelling: {
        $sum: {
          $cond: [
            { $eq: ["$movementType", "out"] },
            {
              $multiply: [
                { $toDouble: { $ifNull: ["$sellingPrice", 0] } },
                { $toDouble: { $ifNull: ["$quantity", 0] } },
              ],
            },
            0,
          ],
        },
      },

      totalQuantityIn: {
        $sum: {
          $cond: [{ $eq: ["$movementType", "in"] }, "$quantity", 0],
        },
      },

      totalQuantityOut: {
        $sum: {
          $cond: [{ $eq: ["$movementType", "out"] }, "$quantity", 0],
        },
      },
    };

    projectStage = {
      _id: 0,
      productId: "$_id",
      productName: "$product.name",
      totalBuying: 1,
      totalSelling: 1,
      totalQuantityIn: 1,
      totalQuantityOut: 1,

      // ⭐ NEW: average buying price
      averageBuying: {
        $cond: [
          { $eq: ["$totalQuantityIn", 0] },
          0,
          { $divide: ["$totalBuying", "$totalQuantityIn"] },
        ],
      },
    };
  }

  const movement = await ProductMovement.aggregate([
    { $match: matchStage },
    { $group: groupStage },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: "$product" },
    { $project: projectStage },
  ]);

  res.status(200).json({
    status: "success",
    data: movement,
  });
});

exports.getProductCostLedger = asyncHandler(async (req, res) => {
  const { companyId, startDate, endDate, page = 1, limit = 20 } = req.query;
  const { id } = req.params;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const currentPage = Number(page);
  const pageLimit = Number(limit);
  const skip = (currentPage - 1) * pageLimit;

  let filters = {
    companyId,
    productId: id,
  };

  if (startDate && endDate) {
    filters.createdAt = {
      $gte: new Date(startDate + "T00:00:00.000Z"),
      $lte: new Date(endDate + "T23:59:59.999Z"),
    };
  }

  const movements = await ProductMovement.find(filters)
    .sort({ createdAt: -1 })
    .populate("productId", "name")
    .populate("reference", "counter")
    .populate("stockId", "name")
    .lean();

  const movementsForCalc = [...movements].reverse();

  let qty = 0;
  let avgCost = 0;
  let value = 0;

  const calculatedMap = new Map();

  for (const mv of movementsForCalc) {
    if (mv.movementType === "in") {
      const newQty = Number(mv.quantity) || 0;
      const newPrice = Number(mv.enterPrice) || 0;

      if (qty + newQty > 0) {
        avgCost = (qty * avgCost + newQty * newPrice) / (qty + newQty);
      }

      qty += newQty;
      value = qty * avgCost;
    }

    if (mv.movementType === "out") {
      const outQty = Number(mv.quantity) || 0;
      const soldAvgCost = mv.outPrice;
      avgCost = (qty * avgCost - outQty * soldAvgCost) / (qty - outQty);

      if (outQty > qty) {
        throw new Error("Not enough stock");
      }

      qty -= outQty;
      value = qty * avgCost;
    }

    calculatedMap.set(mv._id.toString(), {
      qtyAfter: qty,
      avgCostAfter: Number(avgCost),
      valueAfter: Number(value),
      avgCostAfterMainCurrency: Number(avgCost / mv.exchangeRate),
      valueAfterMainCurrency: Number(value / mv.exchangeRate),
    });
  }

  const calculated = movements.map((mv) => {
    const calc = calculatedMap.get(mv._id.toString());

    return {
      name: mv.productId.name,
      movementId: mv._id,
      movementType: mv.movementType,
      newQuantity: calc.qtyAfter,
      avgCostAfter: calc.avgCostAfter,
      valueAfter: calc.valueAfter,
      avgCostAfterMainCurrency: calc.avgCostAfterMainCurrency,
      valueAfterMainCurrency: calc.valueAfterMainCurrency,
      enterPrice: Number(mv.enterPrice),
      date: mv.createdAt,
      source: mv.source,
      quantity: mv.quantity,
      reference: mv.reference,
      source: mv.source,
      outPrice: mv.outPrice,
      sellingPrice: mv.sellingPrice,
      exchangeRate: mv.exchangeRate,
      stockId: mv.stockId,
    };
  });

  // 🔹 Pagination
  const paginatedMovements = calculated.slice(skip, skip + pageLimit);

  res.json({
    status: "success",
    data: {
      finalQty: qty,
      finalAvgCost: Number(avgCost),
      finalValue: Number(value),
      movements: paginatedMovements,
      pagination: {
        page: currentPage,
        limit: pageLimit,
        total: calculated.length,
        totalPages: Math.ceil(calculated.length / pageLimit),
      },
    },
  });
});

exports.getProductMovementReport = asyncHandler(async (req, res) => {
  const { companyId, startDate, endDate, id, category, filter } = req.query;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  let productFilter = { companyId };

  if (id) productFilter._id = id;
  if (category) productFilter.category = category;

  const products = await productModel.find(productFilter).lean();

  if (!products.length) {
    return res.json({ status: "success", data: [] });
  }

  const productIds = products.map((p) => p._id);

  let movementFilter = {
    companyId,
    productId: { $in: productIds },
    type: "movement",
  };

  if (startDate && endDate) {
    movementFilter.createdAt = {
      $gte: new Date(startDate + "T00:00:00.000Z"),
      $lte: new Date(endDate + "T23:59:59.999Z"),
    };
  }

  let movements = await ProductMovement.find(movementFilter)
    .sort({ createdAt: 1 })
    .populate("productId", "name")
    .lean();

  if (filter === "lastBuy" || filter === "lastSell") {
    const movementType = filter === "lastBuy" ? "in" : "out";

    const mv = await ProductMovement.findOne({
      ...movementFilter,
      movementType,
    })
      .sort({ createdAt: -1 })
      .populate("productId", "name")
      .lean();

    if (!mv) return res.json({ status: "success", data: [] });

    return res.json({
      status: "success",
      data: [
        {
          productId: mv.productId._id,
          name: mv.productId.name,
          movementId: mv._id,
          movementType: mv.movementType,
          qty: mv.quantity,
          runningQty: mv.quantity,
          buyingPrice: mv.buyingPrice,
          sellingPrice: mv.sellingPrice,
          date: mv.createdAt,
          source: mv.source,
        },
      ],
    });
  }

  const qtyMap = {};
  const result = [];

  for (const mv of movements) {
    const pid = mv.productId._id;

    if (!qtyMap[pid]) qtyMap[pid] = 0;

    if (mv.movementType === "in") qtyMap[pid] += Number(mv.quantity || 0);
    if (mv.movementType === "out") qtyMap[pid] -= Number(mv.quantity || 0);

    result.push({
      productId: pid,
      name: mv.productId.name,
      movementId: mv._id,
      movementType: mv.movementType,
      qty: mv.quantity,
      runningQty: qtyMap[pid],
      buyingPrice: mv.buyingPrice,
      sellingPrice: mv.sellingPrice,
      date: mv.createdAt,
      source: mv.source,
    });
  }

  res.json({
    status: "success",
    data: result,
  });
});
