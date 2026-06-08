const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const FilesModel = require("../../models/Hr/filesModel");

/**
 * @desc    Get all Files (Master files)
 * @route   GET /api/files
 */
exports.getAllFiles = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
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

  const total = await FilesModel.countDocuments(query);

  const files = await FilesModel.find(query)
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json({
    status: "success",
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results: files.length,
    data: files,
  });
});

/**
 * @desc    Get one File
 * @route   GET /api/files/:id
 */
exports.getOneFile = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const file = await FilesModel.findOne({ _id: id, companyId });

  if (!file) {
    return next(new ApiError(`No File found for id ${id}`, 404));
  }

  res.status(200).json({ status: "success", data: file });
});

/**
 * @desc    Create File
 * @route   POST /api/files
 */
exports.createFile = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  req.body.companyId = companyId;

  const file = await FilesModel.create(req.body);

  res.status(201).json({
    status: "success",
    message: "File created successfully",
    data: file,
  });
});

/**
 * @desc    Update File
 * @route   PUT /api/files/:id
 */
exports.updateFile = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const file = await FilesModel.findOneAndUpdate(
    { _id: id, companyId },
    req.body,
    { new: true },
  );

  if (!file) {
    return next(new ApiError(`No File found for id ${id}`, 404));
  }

  res.status(200).json({
    status: "success",
    message: "File updated successfully",
    data: file,
  });
});

/**
 * @desc    Delete File
 * @route   DELETE /api/files/:id
 */
exports.deleteFile = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const file = await FilesModel.findOneAndDelete({ _id: id, companyId });

  if (!file) {
    return next(new ApiError(`No File found for id ${id}`, 404));
  }

  res.status(200).json({
    status: "success",
    message: "File deleted successfully",
  });
});
