const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const budgetModel = require("../../models/reports/budgetModel");
const accountingTreeModel = require("../../models/accountingTreeModel");

exports.createbudgetReport = asyncHandler(async (req, res) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  req.body.companyId = companyId;
  req.body.employee = req.user.name;

  const createbudget = await budgetModel.create(req.body);
  res.status(201).json({
    status: "success",
    message: "Report Created",
    data: createbudget,
  });
});

exports.getAccountForbudgetReport = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const accounts = await accountingTreeModel.find({
    companyId,
    finalAccount: { $in: ["Profit and Loss Account", "Trading Account"] },
  });

  res.status(201).json({
    status: "success",
    message: "accounts Get Success",
    data: accounts,
  });
});

exports.getAllbudgetReport = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const pageSize = parseInt(req.query.limit) || 10;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * pageSize;

  const totalItems = await budgetModel.countDocuments({ companyId });
  const totalPages = Math.ceil(totalItems / pageSize);
  const budget = await budgetModel
    .find({
      companyId,
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(pageSize);

  res.status(201).json({
    status: "success",
    totalPages: totalPages,
    results: totalItems,
    data: budget,
  });
});

exports.getOneBudgetReport = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const { id } = req.params;
  const budget = await budgetModel.findOne({
    _id: id,
    companyId,
  });
  res.status(201).json({
    status: "success",
    data: budget,
  });
});

exports.updateBudgetReport = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const { id } = req.params;

  const budget = await budgetModel.findOneAndUpdate(
    { _id: id, companyId, status: "Draft" },
    req.body,
    { new: true }
  );

  if (!budget) {
    return next(new ApiError(`No budget report for this id ${id}`, 404));
  }
  res.status(201).json({ status: "success", data: budget });
});

exports.updateBudgetReportsStatus = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const { id } = req.params;
  console.log(req.body);

  const budget = await budgetModel.findOneAndUpdate(
    { _id: id, companyId, status: { $in: ["Draft", "Under Review"] } },
    { status: req.body.status },
    { new: true }
  );

  if (!budget) {
    return next(new ApiError(`No budget report for this id ${id}`, 404));
  }
  res.status(201).json({ status: "success", data: budget });
});
