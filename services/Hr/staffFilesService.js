const StaffFiles = require("../../models/Hr/staffFilesModel");
const ApiError = require("../../utils/apiError");
const asyncHandler = require("express-async-handler");

// services/Hr/staffFilesService.js
exports.createStaffFile = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { staffId, fileTypeId, expiryDate } = req.body;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  if (!staffId || !fileTypeId || !req.savedFiles || !req.savedFiles[0]) {
    return res.status(400).json({ message: "staffId, fileTypeId, and file are required" });
  }

  let fileDoc = {
    staffId,
    fileTypeId,
    expiryDate: expiryDate || null,
    companyId,
    ...req.savedFiles[0],
  };

  if (fileDoc.fileUrl && !fileDoc.fileUrl.startsWith("http")) {
    fileDoc.fileUrl = `${process.env.BASE_URL}/${fileDoc.fileUrl}`;
  }

  const newFile = await StaffFiles.create(fileDoc);

  res.status(201).json({
    status: "success",
    message: "Staff file created successfully",
    data: newFile,
  });
});

exports.getAllStaffFiles = asyncHandler(async (req, res, next) => {
  const { companyId, staffId, keyword } = req.query;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const query = { companyId };

  if (staffId) {
    query.staffId = staffId;
  }

  if (keyword) {
    query.originalName = { $regex: keyword, $options: "i" };
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const total = await StaffFiles.countDocuments(query);

  const files = await StaffFiles.find(query)
    .populate("fileTypeId", "name hasExpiry")
    .populate("staffId", "name")
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: "success",
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results: files.length,
    data: files,
  });
});

/* =====================================================
   GET ONE STAFF FILE
===================================================== */
exports.getOneStaffFile = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { id } = req.params;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const file = await StaffFiles.findOne({ _id: id, companyId })
    .populate("fileTypeId")
    .populate("staffId", "name");

  if (!file) {
    return next(new ApiError("Staff file not found", 404));
  }

  res.status(200).json({ status: "success", data: file });
});

/* =====================================================
   UPDATE STAFF FILE
===================================================== */
exports.updateStaffFile = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { id } = req.params;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const updateData = { ...req.body };

  if (req.file) {
    updateData.fileUrl = req.file.path;
    updateData.originalName = req.file.originalname;
    updateData.mimeType = req.file.mimetype;
    updateData.size = req.file.size;
  }

  const file = await StaffFiles.findOneAndUpdate(
    { _id: id, companyId },
    updateData,
    { new: true },
  );

  if (!file) {
    return next(new ApiError("Staff file not found", 404));
  }

  res.status(200).json({
    status: "success",
    data: file,
  });
});

/* =====================================================
   DELETE STAFF FILE
===================================================== */
exports.deleteStaffFile = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { id } = req.params;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const file = await StaffFiles.findOneAndDelete({ _id: id, companyId });

  if (!file) {
    return next(new ApiError("Staff file not found", 404));
  }

  res.status(200).json({
    status: "success",
    message: "File deleted successfully",
  });
});
