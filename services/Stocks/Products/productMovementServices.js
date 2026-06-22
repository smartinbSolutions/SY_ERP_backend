const asyncHandler = require("express-async-handler");
const ProductMovement = require("../../../models/Stocks/products/productMovementModel");
const { default: mongoose } = require("mongoose");
const productModel = require("../../../models/Stocks/products/productModel");

exports.getAllMovements = async ({
  companyId,
  keyword,
  stockId,
  productId,
  startDate,
  endDate,
  pageSize,
  page,
}) => {
  const skip = (page - 1) * pageSize;

  const matchStage = { companyId };
  if (stockId) matchStage.stockId = new mongoose.Types.ObjectId(stockId);
  if (productId) matchStage.productId = new mongoose.Types.ObjectId(productId);
  if (startDate && endDate) {
    matchStage.movementDate = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const filterStages = [
    { $match: matchStage },
    {
      $lookup: {
        from: "products",
        localField: "productId",
        foreignField: "_id",
        as: "productId",
      },
    },
    { $unwind: "$productId" },
    { $match: { "productId.type": { $ne: "Service" } } },
    {
      $lookup: {
        from: "stocks",
        localField: "stockId",
        foreignField: "_id",
        as: "stockId",
      },
    },
    {
      $unwind: {
        path: "$stockId",
        preserveNullAndEmptyArrays: true,
      },
    },
  ];

  if (keyword) {
    filterStages.push({
      $match: {
        $or: [
          { movementType: { $regex: keyword, $options: "i" } },
          { source: { $regex: keyword, $options: "i" } },
          { "productId.name": { $regex: keyword, $options: "i" } },
        ],
      },
    });
  }

  const [movements, countResult, statsResult] = await Promise.all([
    ProductMovement.aggregate([
      ...filterStages,
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: pageSize },
    ]),
    ProductMovement.aggregate([...filterStages, { $count: "total" }]),
    ProductMovement.aggregate([
      ...filterStages,
      {
        $group: {
          _id: null,
          totalIn: {
            $sum: { $cond: [{ $eq: ["$movementType", "in"] }, "$quantity", 0] },
          },
          totalOut: {
            $sum: {
              $cond: [{ $eq: ["$movementType", "out"] }, "$quantity", 0],
            },
          },
        },
      },
    ]),
  ]);

  const totalItems = countResult[0]?.total || 0;
  const totalPages = pageSize > 0 ? Math.ceil(totalItems / pageSize) : 1;
  const totalIn = statsResult[0]?.totalIn || 0;
  const totalOut = statsResult[0]?.totalOut || 0;

  return {
    movements,
    totalPages,
    totalItems,
    stats: {
      totalMovements: totalItems,
      totalIn,
      totalOut,
      netBalance: totalIn - totalOut,
    },
  };
};

exports.getOneMovement = async ({
  companyId,
  productId,
  movementType,
  startDate,
  endDate,
  pageSize,
  page,
}) => {
  const skip = (page - 1) * pageSize;

  const query = { productId, companyId };
  if (movementType) query.movementType = movementType;
  if (startDate && endDate) {
    query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }

  const [movements, totalItems] = await Promise.all([
    ProductMovement.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize),
    ProductMovement.countDocuments(query),
  ]);

  const totalPages = Math.ceil(totalItems / pageSize);
  return { movements, totalPages, totalItems };
};

exports.getHighestProductMovment = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

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

const BUYING_SOURCES = [
  "Purchase Invoice",
  "Purchase Invoice Cancellation",
  "Purchase Invoice Reverse Update",
  "Refund Purchase Invoice",
];

const SELLING_SOURCES = [
  "Sales Invoice",
  "Sales Invoice Cancellation",
  "Sales Invoice Reverse Update",
  "Refund Sales Invoice",
  "POS Receipt",
  "POS Receipt Cancellation",
  "Refund POS Receipt",
];

exports.getSalesReports = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const idType = req.query.type || "product";
  const { startDate, endDate } = req.query;
  const { id } = req.params;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  let matchStage = { companyId };

  if (startDate && endDate) {
    matchStage.movementDate = {
      $gte: new Date(startDate + "T00:00:00.000Z"),
      $lte: new Date(endDate + "T23:59:59.999Z"),
    };
  }

  if (idType === "product") {
    matchStage.productId = new mongoose.Types.ObjectId(id);
  } else if (idType === "category") {
    const products = await productModel.find(
      { category: id, companyId },
      { _id: 1, name: 1 }
    );
    const ids = products.map((p) => p._id);
    if (ids.length === 0) {
      return res.status(200).json({ status: "success", data: [] });
    }
    matchStage.productId = { $in: ids };
  }

  const groupStage = {
    _id: "$productId",

    // ── BUYING BUCKET ──
    netBoughtQty: {
      $sum: {
        $cond: [
          { $in: ["$source", BUYING_SOURCES] },
          {
            $cond: [
              { $eq: ["$movementType", "in"] },
              "$quantity",
              { $multiply: ["$quantity", -1] },
            ],
          },
          0,
        ],
      },
    },

    netBoughtValueMain: {
      $sum: {
        $cond: [
          { $in: ["$source", BUYING_SOURCES] },
          {
            $cond: [
              { $eq: ["$movementType", "in"] },
              {
                $multiply: [
                  "$enterPriceMainCurrency",
                  { $toDouble: { $ifNull: ["$quantity", 0] } },
                ],
              },
              {
                $multiply: [
                  "$enterPriceMainCurrency",
                  { $toDouble: { $ifNull: ["$quantity", 0] } },
                  -1,
                ],
              },
            ],
          },
          0,
        ],
      },
    },

    // ── SELLING BUCKET ──
    netSoldQty: {
      $sum: {
        $cond: [
          { $in: ["$source", SELLING_SOURCES] },
          {
            $cond: [
              { $eq: ["$movementType", "out"] },
              "$quantity",
              { $multiply: ["$quantity", -1] },
            ],
          },
          0,
        ],
      },
    },

    netSoldValueMain: {
      $sum: {
        $cond: [
          { $in: ["$source", SELLING_SOURCES] },
          {
            $cond: [
              { $eq: ["$movementType", "out"] },
              {
                $multiply: [
                  {
                    $divide: [
                      { $toDouble: { $ifNull: ["$sellingPrice", 0] } },
                      {
                        $cond: [
                          { $eq: ["$exchangeRate", 0] },
                          1,
                          "$exchangeRate",
                        ],
                      },
                    ],
                  },
                  { $toDouble: { $ifNull: ["$quantity", 0] } },
                ],
              },
              {
                $multiply: [
                  {
                    $divide: [
                      { $toDouble: { $ifNull: ["$sellingPrice", 0] } },
                      {
                        $cond: [
                          { $eq: ["$exchangeRate", 0] },
                          1,
                          "$exchangeRate",
                        ],
                      },
                    ],
                  },
                  { $toDouble: { $ifNull: ["$quantity", 0] } },
                  -1,
                ],
              },
            ],
          },
          0,
        ],
      },
    },
  };

  const projectStage = {
    _id: 0,
    productId: "$_id",
    productName: "$product.name",
    netBoughtQty: 1,
    netBoughtValueMain: 1,
    netSoldQty: 1,
    netSoldValueMain: 1,
  };

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
    {
      $unwind: {
        path: "$product",
        preserveNullAndEmptyArrays: true,
      },
    },
    { $project: projectStage },
  ]);

  res.status(200).json({
    status: "success",
    data: movement,
  });
});

exports.getProductCostLedger = asyncHandler(async (req, res) => {
  const { startDate, endDate, page = 1, limit = 20 } = req.query;
  const { id } = req.params;
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const currentPage = Number(page);
  const pageLimit = Number(limit);
  const skip = (currentPage - 1) * pageLimit;

  const filters = {
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

  const safeNumber = (num) => (Number.isFinite(num) ? Number(num) : 0);

  for (const mv of movementsForCalc) {
    const exchangeRate = Number(mv.exchangeRate) || 1;

    if (mv.movementType === "in") {
      const newQty = Number(mv.quantity) || 0;
      const newPrice = Number(mv.enterPrice) || 0;

      if (qty + newQty > 0) {
        avgCost = (qty * avgCost + newQty * newPrice) / (qty + newQty);
      } else {
        avgCost = 0;
      }

      qty += newQty;
      value = qty * avgCost;
    }

    if (mv.movementType === "out") {
      const outQty = Number(mv.quantity) || 0;
      const soldAvgCost = Number(mv.outPrice) || 0;

      if (outQty > qty) {
        throw new Error("Not enough stock");
      }

      const remainingQty = qty - outQty;

      if (remainingQty === 0) {
        qty = 0;
        avgCost = 0;
        value = 0;
      } else {
        avgCost = (qty * avgCost - outQty * soldAvgCost) / remainingQty;
        qty = remainingQty;
        value = qty * avgCost;
      }
    }

    calculatedMap.set(mv._id.toString(), {
      qtyAfter: safeNumber(qty),
      avgCostAfter: safeNumber(avgCost),
      valueAfter: safeNumber(value),
      avgCostAfterMainCurrency: safeNumber(avgCost / exchangeRate),
      valueAfterMainCurrency: safeNumber(value / exchangeRate),
    });
  }

  const calculated = movements.map((mv) => {
    const calc = calculatedMap.get(mv._id.toString()) || {
      qtyAfter: 0,
      avgCostAfter: 0,
      valueAfter: 0,
      avgCostAfterMainCurrency: 0,
      valueAfterMainCurrency: 0,
    };

    return {
      name: mv.productId?.name || "",
      movementId: mv._id,
      movementType: mv.movementType,
      newQuantity: calc.qtyAfter,
      avgCostAfter: calc.avgCostAfter,
      valueAfter: calc.valueAfter,
      avgCostAfterMainCurrency: calc.avgCostAfterMainCurrency,
      valueAfterMainCurrency: calc.valueAfterMainCurrency,
      enterPrice: Number(mv.enterPrice) || 0,
      date: mv.createdAt,
      source: mv.source,
      quantity: Number(mv.quantity) || 0,
      reference: mv.reference,
      outPrice: Number(mv.outPrice) || 0,
      sellingPrice: Number(mv.sellingPrice) || 0,
      exchangeRate: Number(mv.exchangeRate) || 1,
      stockId: mv.stockId,
    };
  });

  const paginatedMovements = calculated.slice(skip, skip + pageLimit);

  res.json({
    status: "success",
    data: {
      finalQty: safeNumber(qty),
      finalAvgCost: safeNumber(avgCost),
      finalValue: safeNumber(value),
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
  const { startDate, endDate, id, category, filter } = req.query;
  const companyId = req.companyId;

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
