const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const StaffsModel = require("../../models/Hr/staffModel");
const staffFilesModel = require("../../models/Hr/staffFilesModel");
const multer = require("multer");
const multerStorage = multer.memoryStorage();
const sharp = require("sharp");
const { v4: uuidv4 } = require("uuid");
const SalaryHistoryModel = require("../../models/Hr/salaryHistoryModel");
const bcrypt = require("bcrypt");
const generatePassword = require("../../utils/tools/generatePassword");
const sendEmail = require("../../utils/sendEmail");
const fs = require("fs");

const multerFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp|gif|pdf|doc|docx|xls|xlsx|txt/;
  const ext = file.originalname.split(".").pop().toLowerCase();

  if (allowed.test(ext)) {
    cb(null, true);
  } else {
    cb(new ApiError("Invalid file type", 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

exports.uploadStaffAssets = upload.fields([
  { name: "profileImage", maxCount: 1 },
  { name: "files", maxCount: 10 },
]);

/* ======================================================
   PROCESS PROFILE IMAGE
====================================================== */
exports.processProfileImage = asyncHandler(async (req, res, next) => {
  if (!req.files?.profileImage) return next();

  const file = req.files.profileImage[0];
  const filename = `profileImage-${uuidv4()}-${Date.now()}.png`;
  const dir = "uploads/profileImage";

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  await sharp(file.buffer)
    .resize({ width: 500 })
    .png({ quality: 70 })
    .toFile(`${dir}/${filename}`);

  req.body.profileImage = filename;
  next();
});

/* ======================================================
   PROCESS STAFF FILES
====================================================== */
exports.processStaffFiles = asyncHandler(async (req, res, next) => {
  if (!req.files?.files || req.files.files.length === 0) {
    req.savedFiles = [];
    return next();
  }

  const dir = "uploads/hrDocs";
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  req.savedFiles = [];

  for (const file of req.files.files) {
    const isImage = file.mimetype.startsWith("image");
    const extension = isImage
      ? "png"
      : file.originalname.split(".").pop().toLowerCase();

    // ✅ اسم الملف فقط (بدون مسار)
    const filename = `staffFile-${uuidv4()}-${Date.now()}.${extension}`;
    const filepath = `${dir}/${filename}`;

    if (isImage) {
      await sharp(file.buffer)
        .resize({ width: 1200, withoutEnlargement: true })
        .png({ quality: 70 })
        .toFile(filepath);
    } else {
      fs.writeFileSync(filepath, file.buffer);
    }

    req.savedFiles.push({
      fileUrl: `hrDocs/${filename}`, // ✅ بدون uploads
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    });
  }

  next();
});

/* ===================== GET STAFF LIST ===================== */
exports.getStaff = asyncHandler(async (req, res) => {
  const companyId = req.query.companyId;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const limit = Number(req.query.limit) || 10;
  const page = Number(req.query.page) || 1;
  const skip = (page - 1) * limit;

  let query = { companyId };

  // =========================
  //  Search by keyword
  // =========================
  if (req.query.keyword) {
    query.$or = [
      { name: { $regex: req.query.keyword, $options: "i" } },
      { email: { $regex: req.query.keyword, $options: "i" } },
      { phoneNumber: { $regex: req.query.keyword, $options: "i" } },
    ];
  }

  // =========================
  //  Filter by Branch
  // =========================
  if (req.query.branch) {
    query.branch = req.query.branch;
  }

  // =========================
  //  Count
  // =========================
  const totalItems = await StaffsModel.countDocuments(query);

  // =========================
  // Fetch Data
  // =========================
  const staffs = await StaffsModel.find(query)
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 })
    .populate("currency")
    .populate("position")
    .populate("branch")
    .populate("department");

  res.status(200).json({
    status: "success",
    results: totalItems,
    page,
    limit,
    totalPages: Math.ceil(totalItems / limit),
    data: staffs,
  });
});

/* ===================== CREATE STAFF ===================== */
exports.createStaff = asyncHandler(async (req, res) => {
  const companyId = req.query.companyId;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  req.body.companyId = companyId;

  // if (req.body.tags) {
  //   req.body.tags = JSON.parse(req.body.tags);
  // }

  const employeePass = generatePassword();

  await sendEmail({
    email: req.body.email,
    subject: "New Account Password",
    message: `Hello ${req.body.name}, your password is: ${employeePass}`,
  });

  req.body.password = await bcrypt.hash(employeePass, 12);
  if (req.body.customAttributes) {
    req.body.customAttributes = JSON.parse(req.body.customAttributes);
  }

  const staff = await StaffsModel.create(req.body);

  if (req.body.staffFilesMeta && req.savedFiles.length) {
    const filesMeta = JSON.parse(req.body.staffFilesMeta);

    const staffFilesDocs = req.savedFiles.map((file, index) => ({
      staffId: staff._id,
      fileTypeId: filesMeta[index]?.fileTypeId,
      expiryDate: filesMeta[index]?.expiryDate || null,
      companyId,
      ...file,
    }));

    await staffFilesModel.insertMany(staffFilesDocs);
  }

  res.status(201).json({
    status: "success",
    message: "Staff created successfully",
    data: staff,
  });
});

/* ===================== GET ONE STAFF ===================== */
exports.getOneStaff = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const staff = await StaffsModel.findOne({
    _id: req.params.id,
    companyId,
  })
    .populate("currency")
    .populate("position");

  if (!staff) {
    return next(new ApiError("Staff not found", 404));
  }

  res.status(200).json({
    status: "success",
    data: staff,
  });
});

/* ===================== UPDATE STAFF ===================== */
exports.updateStaff = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  if (req.body.tags) {
    req.body.tags = JSON.parse(req.body.tags);
  }

  const staff = await StaffsModel.findOneAndUpdate(
    { _id: req.params.id, companyId },
    req.body,
    { new: true }
  );

  if (!staff) {
    return next(new ApiError("Staff not found", 404));
  }

  res.status(200).json({
    status: "success",
    message: "Staff updated successfully",
    data: staff,
  });
});

/* ===================== DELETE STAFF ===================== */
exports.deleteStaff = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const staff = await StaffsModel.findOne({
    _id: req.params.id,
    companyId,
  });

  if (!staff) {
    return next(new ApiError("Staff not found", 404));
  }

  const salaryHistoryCount = await SalaryHistoryModel.countDocuments({
    employeeId: staff._id,
    companyId,
  });

  if (salaryHistoryCount > 0) {
    await StaffsModel.findByIdAndUpdate(staff._id, {
      employmentStatus: !staff.employmentStatus,
    });
  } else {
    await StaffsModel.findByIdAndDelete(staff._id);
  }

  res.status(200).json({
    status: "success",
    message: "Staff deleted successfully",
  });
});
