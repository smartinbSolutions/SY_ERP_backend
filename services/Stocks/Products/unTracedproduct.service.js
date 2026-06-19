const unTracedproductLogModel = require("../../../models/Stocks/products/unTracedproductLogModel");

exports.getUnTracedproductLogService = async ({ companyId, req }) => {
  const pageSize = parseInt(req.query.limit) || 10;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * pageSize;
  const { startDate, endDate } = req.query;

  let query = { companyId };
  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    query.createdAt = {
      $gte: start,
      $lte: end,
    };
  }
  console.log(req.query.keyword);

  if (req.query.keyword !== null) {
    query.$or = [
      {
        name: {
          $regex: req.query.keyword,
          $options: "i",
        },
      },
    ];
  }
  const totalItems = await unTracedproductLogModel.countDocuments(query);
  const totalPages = Math.ceil(totalItems / pageSize);
  const UnTracedproductLog = await unTracedproductLogModel
    .find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(pageSize);

  return {
    totalPages: totalPages,
    results: totalItems,
    data: UnTracedproductLog,
  };
};

exports.getOneUnTracedproductLogService = async ({ companyId, id }) => {
  const UnTracedproductLog = await unTracedproductLogModel.findOne({
    _id: id,
    companyId,
  });
  if (!UnTracedproductLog) {
    throw new ApiError(`No UnTracedproductLog by this id ${id}`, 404);
  }
  return UnTracedproductLog;
};
