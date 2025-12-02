const asyncHandler = require("express-async-handler");
const ShortageModel = require("../models/ShortageModel");

exports.createShortage = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  req.body.companyId = companyId;
  const shortage = await ShortageModel.create(req.body);
  res.status(200).json({
    status: "success",
    data: shortage,
  });
});

exports.getAllShortage = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const pageSize = parseInt(req.query.limit) || 10;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * pageSize;

  const query = { companyId };
  if (companyId) query.companyId = companyId;

  if (req.query.keyword) {
    query.$or = [{ name: { $regex: req.query.keyword, $options: "i" } }];
  }

  const totalItems = await ShortageModel.countDocuments(query);

  const totalPages = Math.ceil(totalItems / pageSize);
  const shortages = await ShortageModel.find(query)
    .skip(skip)
    .limit(pageSize)
    .populate({
      path: "productId",
      select: "name qr stocks unit buyingprice tax currency",
      populate: [
        {
          path: "unit",
          model: "Unit",
          select: "name code",
        },
        {
          path: "tax",
          model: "Tax",
          select: "name tax",
        },
        {
          path: "currency",
          model: "Currency",
          select: "name exchangeRate",
        },
      ],
    });
  res.status(200).json({ totalPages, results: totalItems, shortages });
});
