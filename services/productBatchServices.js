const prodcutBatchModel = require("../models/Stocks/products/prodcutBatchModel");
const batchLedgerModel = require("../models/Stocks/products/batchLedgerModel");
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");

// exports.createProductBatch = async function createProductBatch({
//   productId,
//   companyId,
//   stockId,
//   quantity,
//   buyingprice,
//   sourceId,
//   costBuyingPrice,
//   referenceType,
//   batchDate,
//   session,
// }) {
//   const batchPayload = {
//     productId,
//     companyId,
//     stockId,
//     quantity,
//     remaining: quantity,
//     buyingprice,
//     sourceId,
//     costBuyingPrice,
//     sourceType: referenceType,
//     batchDate: batchDate ? new Date(batchDate) : new Date(),
//     status: "active",
//   };

//   const [batch] = session
//     ? await prodcutBatchModel.create([batchPayload], { session })
//     : await prodcutBatchModel.create([batchPayload]);

//   const ledgerPayload = {
//     productId,
//     companyId,
//     stockId,
//     type: "in",
//     quantity,
//     cost: quantity * buyingprice,
//     batchId: batch._id,
//     referenceType,
//     referenceId: sourceId,
//     costBuyingPrice,
//     movementDate: batchDate ? new Date(batchDate) : new Date(),
//   };

//   if (session) {
//     await productLedgerModel.create([ledgerPayload], { session });
//   } else {
//     await productLedgerModel.create(ledgerPayload);
//   }

//   return batch;
// };

exports.createProductBatch = async function createProductBatch({
  productId,
  companyId,
  stockId,
  quantity,
  buyingprice,
  sourceId,
  sourceType,
  batchDate,
  session,

  // optional lineage fields
  originId = null,
  originType = null,
  parentBatchId = null,

  // optional extra batch cost context
  costBuyingPrice = 0,
}) {
  const resolvedBatchDate = batchDate ? new Date(batchDate) : new Date();

  const batchPayload = {
    productId,
    companyId,
    stockId,
    quantity,
    remaining: quantity,
    buyingprice,
    costBuyingPrice,

    // direct creator of this batch row
    sourceId,
    sourceType,

    // original root source of this stock
    originId: originId || sourceId,
    originType: originType || sourceType,

    // only used when this batch came from another batch
    parentBatchId,

    batchDate: resolvedBatchDate,
    status: "active",
  };

  const createdBatches = session
    ? await prodcutBatchModel.create([batchPayload], { session })
    : await prodcutBatchModel.create([batchPayload]);

  const createdBatch = createdBatches[0];

  const batchLedgerPayload = {
    batchId: createdBatch._id,
    productId,
    companyId,
    stockId,
    type: "in",
    quantity,
    referenceType: sourceType,
    referenceId: sourceId,
    movementDate: resolvedBatchDate,
  };

  if (session) {
    await batchLedgerModel.create([batchLedgerPayload], { session });
  } else {
    await batchLedgerModel.create(batchLedgerPayload);
  }

  return createdBatch;
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
