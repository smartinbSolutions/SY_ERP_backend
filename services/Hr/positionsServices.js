const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const positionsModel = require("../../models/Hr/positionsModel");

exports.getAllPositions = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const positions = await positionsModel.find({ companyId }).lean();
  res
    .status(200)
    .json({ status: "success", results: positions.length, data: positions });
});

exports.getOnePositions = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      status: false,
      message: "Invalid Position ID format",
    });
  }
  const positions = await positionsModel.findOne({
    _id: req.params.id,
    companyId,
  });
  if (!positions) {
    return res.status(404).json({
      status: false,
      message: "Position not found",
    });
  }

  res.status(200).json({ status: "success", data: positions });
});

exports.createPositions = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const positionData = {
    name: req.body.name,
    nameAR: req.body.nameAR,
    nameTR: req.body.nameTR,
    description: req.body.description,
    departmentId: req.body.departmentId,
    parentPositions: req.body.parentPositions || null,
    children: req.body.children || [],
    sync: req.body.sync || false,
    companyId: companyId,
  };

  const position = await positionsModel.create(positionData);

  res.status(200).json({ status: "success", data: position });
});
exports.updatePositions = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  req.body.companyId = companyId;

  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      status: false,
      message: "Invalid Position ID format",
    });
  }
  const positions = await positionsModel.findOneAndUpdate(
    { _id: id, companyId },
    req.body,
    {
      new: true,
    }
  );

  if (!positions) {
    return res.status(404).json({
      status: false,
      message: "Position not found",
    });
  }

  res.status(200).json({ status: "success", data: positions });
});

exports.deletePositions = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      status: false,
      message: "Invalid Position ID format",
    });
  }
  const positions = await positionsModel.findOneAndDelete({
    _id: id,
    companyId,
  });

  if (!positions) {
    res.status(404).json({ status: "fail", message: `Position not found` });
  }

  res
    .status(200)
    .json({
      status: "success",
      data: positions,
      message: "Deleted successfully",
    });
});
