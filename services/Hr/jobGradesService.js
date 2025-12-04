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

  const grades = await jobGradesModel.find({ companyId }).lean();

  res.status(200).json({
    status: "success",
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
    nameAR: req.body.nameAR,
    nameTR: req.body.nameTR,
    description: req.body.description,
    levelNumber: req.body.levelNumber,
    salary: {
      min: req.body.salary?.min,
      max: req.body.salary?.max,
    },
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
