const {
  getUnTracedproductLogService,
  getOneUnTracedproductLogService,
} = require("../../../services/Stocks/Products/unTracedproduct.service");
const asyncHandler = require("express-async-handler");

exports.getUnTracedproductLog = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const { totalPages, results, data } = await getUnTracedproductLogService({
    companyId,
    req,
  });
  console.log(data);
  res.status(200).json({
    totalPages,
    results,
    data,
  });
});

exports.getOneUnTracedproductLog = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const UnTracedproductLog = await getOneUnTracedproductLogService({
    currencyId: id,
    companyId,
  });

  res.status(200).json({
    status: true,
    data: UnTracedproductLog,
  });
});
