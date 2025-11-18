const asyncHandler = require("express-async-handler");
const ProductMovement = require("../models/productMovementModel");

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

  const query = { productId: id, companyId };
  const totalItems = await ProductMovement.countDocuments(query);
  const totalPages = Math.ceil(totalItems / pageSize);
  if (req.query.movementType) {
    query.movementType = req.query.movementType;
  }
  if (req.query.source) {
    query.source = { $regex: req.query.source, $options: "i" };
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
    console.log(endDate);

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
