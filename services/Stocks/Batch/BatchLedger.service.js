const batchLedgerModel = require("../../../models/Stocks/products/batchLedgerModel");

exports.findAllBatchLedgerForProductService = async ({ req, companyId }) => {
  const pageSize = Number(req.query.limit) || 20;
  const page = Number(req.query.page) || 1;
  const skip = (page - 1) * pageSize;

  const query = { companyId, batchId: req.params.id };

  //   if (filters?.startDate || filters?.endDate) {
  //     query.date = {};
  //     if (filters?.startDate) query.movementDate.$gte = filters.startDate;
  //     if (filters?.endDate) query.movementDate.$lte = filters.endDate;
  //   }

  const totalItems = await batchLedgerModel.countDocuments(query);

  const totalPages = Math.ceil(totalItems / pageSize);
  const batchLedger = await batchLedgerModel
    .find(query)
    .sort({ movementDate: -1 })
    .skip(skip)
    .limit(pageSize);

  return {
    totalItems,
    totalPages,
    batchLedger,
  };
};
