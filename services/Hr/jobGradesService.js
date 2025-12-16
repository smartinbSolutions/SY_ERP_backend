const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const jobGradesModel = require("../../models/Hr/jobGradesModel");

// ===============================
//        GET ALL GRADES
// ===============================
exports.getAllGrades = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const query = { companyId };
  if (req.query.keyword) {
    query.$or = [{ name: { $regex: req.query.keyword, $options: "i" } }];
  }

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const total = await jobGradesModel.countDocuments(query);

  const grades = await jobGradesModel
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
    results: grades.length,
    data: grades,
  });
});

// ===============================
//        GET ONE GRADE
// ===============================
exports.getOneGrade = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  const { id } = req.params;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      status: false,
      message: "Invalid Grade ID format",
    });
  }

  const grade = await jobGradesModel.findOne({ _id: id, companyId });

  if (!grade) {
    return res.status(404).json({
      status: false,
      message: "Grade not found",
    });
  }

  res.status(200).json({ status: "success", data: grade });
});

// ===============================
//        CREATE GRADE
// ===============================
exports.createGrades = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const gradeData = {
    name: req.body.name,
    AlternativeName: req.body.AlternativeName,
    description: req.body.description,
    levelNumber: req.body.levelNumber,
    companyId: companyId,
  };

  const grade = await jobGradesModel.create(gradeData);

  res.status(200).json({
    status: "success",
    data: grade,
  });
});

// ===============================
//        UPDATE GRADE
// ===============================
exports.updateGrades = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  const { id } = req.params;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      status: false,
      message: "Invalid Grade ID format",
    });
  }

  req.body.companyId = companyId;

  const grade = await jobGradesModel.findOneAndUpdate(
    { _id: id, companyId },
    req.body,
    { new: true }
  );

  if (!grade) {
    return res.status(404).json({
      status: false,
      message: "Grade not found",
    });
  }

  res.status(200).json({
    status: "success",
    data: grade,
  });
});

// ===============================
//        DELETE GRADE
// ===============================
exports.deleteGrades = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  const { id } = req.params;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      status: false,
      message: "Invalid Grade ID format",
    });
  }

  const grade = await jobGradesModel.findOneAndDelete({
    _id: id,
    companyId,
  });

  if (!grade) {
    return res.status(404).json({
      status: "fail",
      message: "Grade not found",
    });
  }

  res.status(200).json({
    status: "success",
    data: grade,
    message: "Deleted successfully",
  });
});
