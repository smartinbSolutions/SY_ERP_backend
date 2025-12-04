const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const branchesModel = require("../../models/Hr/branchesModel");

/////////
exports.getAllBranches = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const query = { companyId };

  if (req.query.keyword) {
    query.$or = [{ name: { $regex: req.query.keyword, $options: "i" } }];
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const total = await branchesModel.countDocuments(query);

  const branch = await branchesModel
    .find(query)
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json({
    status: "success",
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results: branch.length,
    data: branch,
  });
});

////////
exports.getOneBranch = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      status: false,
      message: "Invalid Branch ID format",
    });
  }
  const branch = await branchesModel.findOne({
    _id: req.params.id,
    companyId,
  });

  if (!branch) {
    res
      .status(404)
      .json({ status: "fail", message: `No Branch found for ID: ${id}` });
  }

  res.status(200).json({ status: "success", data: branch });
});

/////////
exports.createBranch = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const branchData = {
    name: req.body.name,
    nameAR: req.body.nameAR,
    nameTR: req.body.nameTR,
    location: req.body.location,
    email: req.body.email,
    companyId: companyId,
  };

  // إنشاء الفرع
  const branch = await branchesModel.create(branchData);

  // الرد بالفرع الجديد
  res.status(200).json({ status: "success", data: branch });
});

//////
exports.updateBranch = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  req.body.companyId = companyId;
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      status: false,
      message: "Invalid Branch ID format",
    });
  }
  const branch = await branchesModel.findOneAndUpdate(
    { _id: id, companyId },
    req.body,
    {
      new: true,
    }
  );

  if (!branch) {
    res
      .status(404)
      .json({ status: "fail", message: `No Branch found for ID: ${id}` });
  }

  res.status(200).json({ status: "success", data: branch });
});

////////
exports.deleteBranch = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      status: false,
      message: "Invalid Branch ID format",
    });
  }

  const branch = await branchesModel.findOneAndDelete({
    _id: id,
    companyId,
  });

  if (!branch) {
    res
      .status(404)
      .json({ status: "fail", message: `No Branch found for ID: ${id}` });
  }

  res.status(200).json({
    status: "success",
    data: branch,
    message: "Deleted successfully",
  });
});
