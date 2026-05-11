const asyncHandler = require("express-async-handler");
const {
  findAllBatchLedgerForProductService,
} = require("../../../services/Stocks/Batch/BatchLedger.service");

exports.findAllBatchLedgerForProduct = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const { totalItems, totalPages, batchLedger } =
    await findAllBatchLedgerForProductService({
      req,
      companyId,
    });

  res.status(200).json({
    status: "true",
    Pages: totalPages,
    results: totalItems,
    data: batchLedger,
  });
});
