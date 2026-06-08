const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const unitService = require("../../../services/Settings/Definition/unit.service");

exports.getUnits = asyncHandler(async (req, res) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const result = await unitService.getUnits({
    companyId,
  });

  return res.status(200).json({
    status: "success",
    results: result.results,
    data: result.data,
  });
});

exports.getUnit = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const id = req.params.id;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const result = await unitService.getUnit({
    companyId,
    id,
  });
  return res.status(200).json({
    status: "success",
    data: result.data,
  });
});

exports.createUnit = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const session = await mongoose.startSession();
  session.startTransaction();
  const result = await unitService.createUnit({
    companyId,
    data: req.body,
    session,
  });
  await session.commitTransaction();
  session.endSession();

  return res.status(200).json({
    status: "success",
    data: result.data,
  });
});

exports.updateUnit = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const id = req.params.id;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const session = await mongoose.startSession();
  session.startTransaction();
  const result = await unitService.updateUnit({
    companyId,
    id,
    data: req.body,
    session,
  });
  await session.commitTransaction();
  session.endSession();
  return res.status(200).json({
    status: "success",
    data: result.data,
  });
});

exports.deleteUnit = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const id = req.params.id;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const session = await mongoose.startSession();
  session.startTransaction();
  const result = await unitService.deleteUnit({
    companyId,
    id,
    session,
  });
  await session.commitTransaction();
  session.endSession();
  return res.status(200).json({
    status: "success",
    data: result.data,
  });
});
