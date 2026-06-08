const ApiError = require("../utils/apiError");
const reconciliationModel = require("../models/reconciliationModel");
const asyncHandler = require("express-async-handler");

exports.getReconciliations = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const pageSize = parseInt(req.query.limit) || 10;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * pageSize;
  let query = { companyId };
  if (req.query.keyword) {
    query.$or = [
      { desc: { $regex: req.query.keyword, $options: "i" } },
      { journalLineCounter: { $regex: req.query.keyword, $options: "i" } },
      { matchedBy: { $regex: req.query.keyword, $options: "i" } },
    ];
  }
  const totalItems = await brandModel.countDocuments(query);
  const totalPages = Math.ceil(totalItems / pageSize);
  const reconciliation = await reconciliationModel
    .find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(pageSize);
  res.status(200).json({
    status: "success",
    totalPages: totalPages,
    results: totalItems,
    data: reconciliation,
  });
});

exports.createReconciliatio = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  req.body.matchedBy = req.user.name;
  req.body.companyId = companyId;

  const Reconciliatio = await reconciliationModel.create(req.body);
  res.status(201).json({
    status: "success",
    message: "Reconciliatio Inserted",
    data: Reconciliatio,
  });
});

exports.getOneReconciliatio = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const { id } = req.params;
  const Reconciliatio = await reconciliationModel.findOne({
    _id: id,
    companyId,
  });
  res.status(201).json({
    status: "success",
    data: Reconciliatio,
  });
});

exports.deleteReconciliatio = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const { id } = req.params;
  await reconciliationModel.findOneAndDelete({
    _id: id,
    companyId,
  });
  res.status(201).json({
    status: "success",
    message: "Reconciliatio Deleted",
  });
});

exports.getAllReconciliationsForAccount = asyncHandler(
  async (req, res, next) => {
    const companyId = req.companyId;

    if (!companyId) {
      return res.status(400).json({ message: "companyId is required" });
    }
    const { id } = req.params;

    const Reconciliatio = await reconciliationModel.find({
      accoutId: id,
      companyId,
    });

    res.status(201).json({
      status: "success",
      data: Reconciliatio,
    });
  },
);
