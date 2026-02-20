const prodcutBatchModel = require("../models/prodcutBatchModel");
const productLedgerModel = require("../models/productLedgerModel");
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");

exports.createProductBatch = async function createProductBatch({
  productId,
  companyId,
  stockId,
  quantity,
  buyingprice,
  sourceId,
  costBuyingPrice,
  referenceType,
  batchDate,
}) {
  const batch = await prodcutBatchModel.create({
    productId,
    companyId,
    stockId,
    quantity,
    remaining: quantity,
    buyingprice,
    sourceId,
    costBuyingPrice,
    sourceType: referenceType,
    batchDate: batchDate ? new Date(batchDate) : new Date(),
  });

  await productLedgerModel.create({
    productId,
    companyId,
    stockId,
    type: "in",
    quantity,
    cost: quantity * buyingprice,
    batchId: batch._id,
    referenceType,
    referenceId: sourceId,
    costBuyingPrice,
    movementDate: batchDate ? new Date(batchDate) : new Date(),
  });

  return batch;
};

exports.getAllProductBatch = asyncHandler(async (req, res) => {
  const { companyId, page = 1, limit = 10 } = req.query;
  const { id } = req.params;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const currentPage = Number(page);
  const pageLimit = Number(limit);
  const skip = (currentPage - 1) * pageLimit;

  const filters = {
    companyId,
    productId: new mongoose.Types.ObjectId(id),
  };

  const [data, totalItems] = await Promise.all([
    prodcutBatchModel.aggregate([
      { $match: filters },
      {
        $lookup: {
          from: "stocks",
          localField: "stockId",
          foreignField: "_id",
          as: "stock",
        },
      },
      {
        $unwind: {
          path: "$stock",
          preserveNullAndEmptyArrays: true,
        },
      },
      { $sort: { createdAt: 1 } },

      {
        $setWindowFields: {
          sortBy: { createdAt: 1 },
          output: {
            cumulativeQuantity: {
              $sum: "$quantity",
              window: {
                documents: ["unbounded", "current"],
              },
            },
            remainingTotalQuantity: {
              $sum: "$remaining",
              window: {
                documents: ["unbounded", "current"],
              },
            },
          },
        },
      },

      { $sort: { createdAt: -1 } },

      { $skip: skip },
      { $limit: pageLimit },
    ]),

    prodcutBatchModel.countDocuments(filters),
  ]);

  const totalPages = Math.ceil(totalItems / pageLimit);

  res.status(200).json({
    status: true,
    results: totalItems,
    pages: totalPages,
    data,
  });
});
