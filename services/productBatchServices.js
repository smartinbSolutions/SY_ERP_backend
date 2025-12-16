const prodcutBatchModel = require("../models/prodcutBatchModel");
const productLedgerModel = require("../models/productLedgerModel");
const productModel = require("../models/productModel");

exports.addStock = async function addStock({
  productId,
  companyId,
  stockId,
  quantity,
  buyingprice,
  sourceId,
  costBuyingPrice,
  totalStockQuantity,
}) {
  const batch = await prodcutBatchModel.create({
    productId,
    companyId,
    stockId,
    quantity,
    remaining: totalStockQuantity,
    buyingprice,
    sourceId,
    costBuyingPrice,
  });

  await productLedgerModel.create({
    productId,
    companyId,
    stockId,
    type: "in",
    quantity,
    cost: quantity * buyingprice,
    batchId: batch._id,
    referenceType: "purchase",
    referenceId: sourceId,
    costBuyingPrice,
  });

  return batch;
};
