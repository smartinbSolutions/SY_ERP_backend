const asyncHandler = require("express-async-handler");
const currencyLogModel = require("../models/currencyLogModel");

exports.getCurrencyLog = asyncHandler(async (req, res) => {
  const { companyId, id, page = 1, limit = 50 } = req.query;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const skip = (page - 1) * limit;

  const filter = { currencyId: req.params.id, companyId };

  const logs = await currencyLogModel
    .find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

  const total = await currencyLogModel.countDocuments(filter);

  res.json({
    success: true,
    page: Number(page),
    limit: Number(limit),
    total,
    data: logs,
  });
});
