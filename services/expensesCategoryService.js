const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const expensesCategoryModel = require("../models/expensesCategoryModel");
const ApiError = require("../utils/apiError");
const AccountingTreeSchema = require("../models/accountingTreeModel");
const currencySchema = require("../models/currencyModel");

// Create new expense category
// @route get /api/expenseCategories
exports.createExpenseCategory = asyncHandler(async (req, res, next) => {
  try {
    const companyId = req.query.companyId;

    if (!companyId) {
      return res.status(400).json({ message: "companyId is required" });
    }
    req.body.companyId = companyId;

    const expenseCategory = await expensesCategoryModel.create(req.body);
    res.status(201).json({
      status: "true",
      message: "expense Category Inserted",
      data: expenseCategory,
    });
  } catch (error) {
    return next(new ApiError(error, 404));
  }
});

// Get all expense categories
// @route get /api/expenseCategories
exports.getExpenseCategories = asyncHandler(async (req, res, next) => {
  try {
    const { companyId, keyword = "", limit, page } = req.query;

    if (!companyId) {
      return res.status(400).json({ message: "companyId is required" });
    }

    const pageSize = parseInt(limit, 10) || 10;
    const currentPage = parseInt(page, 10) || 1;
    const skip = (currentPage - 1) * pageSize;

    const matchStage = { companyId };
    if (keyword.trim()) {
      matchStage.$or = [
        { expenseCategoryName: { $regex: keyword, $options: "i" } },
        { "linkAccount.name": { $regex: keyword, $options: "i" } },
        { "tag.tagName": { $regex: keyword, $options: "i" } },
      ];
    }

    // 🔹 مراحل مشتركة (Lookup + Unwind)
    const commonLookups = [
      {
        $lookup: {
          from: "accountingtrees",
          localField: "linkAccount",
          foreignField: "_id",
          as: "linkAccount",
        },
      },
      { $unwind: { path: "$linkAccount", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "currencies",
          localField: "linkAccount.currency",
          foreignField: "_id",
          as: "linkAccount.currency",
        },
      },
      {
        $unwind: {
          path: "$linkAccount.currency",
          preserveNullAndEmptyArrays: true,
        },
      },
    ];

    const pipeline = [
      { $match: matchStage },
      ...commonLookups,
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: pageSize },
    ];

    const expenseCategories = await expensesCategoryModel.aggregate(pipeline);

    const startIndex = skip + 1;
    const numberedCategories = expenseCategories.map((item, index) => ({
      serial: startIndex + index,
      ...item,
    }));

    const countPipeline = [
      { $match: matchStage },
      ...commonLookups,
      { $count: "total" },
    ];
    const countResult = await expensesCategoryModel.aggregate(countPipeline);

    const totalItems = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalItems / pageSize);

    res.status(200).json({
      status: "true",
      pages: totalPages,
      results: totalItems,

      data: numberedCategories,
    });
  } catch (error) {
    return next(new ApiError(error.message || error, 500));
  }
});

// Get one expense category
// @route get /api/expenseCategories/:id
exports.getOneExpenseCategory = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  const { id } = req.params;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const expenseCategory = await expensesCategoryModel
    .findOne({ _id: id, companyId })
    .populate({
      path: "linkAccount",
      populate: {
        path: "currency",
        model: "Currency",
      },
    });
  if (!expenseCategory) {
    return next(
      new ApiError(`There is no expense category with this id ${id}`, 404)
    );
  } else {
    res.status(200).json({ status: "true", data: expenseCategory });
  }
});

// Delete One expense category
// @route delete /api/expenseCategories/:id
exports.deleteOneExpenseCategory = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  const { id } = req.params;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const expenseCategory = await expensesCategoryModel.findOneAndDelete({
    _id: id,
    companyId,
  });

  if (!expenseCategory) {
    return next(
      new ApiError(`There is no expense category with this id ${id}`, 404)
    );
  } else {
    res
      .status(200)
      .json({ status: "true", message: "Expense category deleted" });
  }
});

// @desc Update specific expense category
// @route delete /api/expenseCategories/:id
exports.updateOneExpenseCategory = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  req.body.companyId = companyId;
  const expenseCategory = await expensesCategoryModel.findOneAndUpdate(
    { _id: id, companyId },
    req.body,
    {
      new: true,
    }
  );
  if (!expenseCategory) {
    return next(
      new ApiError(`There is no expense category with this id ${id}`, 404)
    );
  } else {
    res
      .status(200)
      .json({ status: "true", message: "Expense category updated" });
  }
});
