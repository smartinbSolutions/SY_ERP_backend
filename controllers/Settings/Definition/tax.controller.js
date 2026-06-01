const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const taxService = require("../../../services/Settings/Definition/tax.service");

exports.getTaxs = asyncHandler(async (req, res) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const result = await taxService.getTaxs({
    companyId,
  });

  return res.status(200).json({
    status: "success",
    results: result.results,
    data: result.data,
  });
});

exports.getTax = asyncHandler(async (req, res) => {
  const companyId = req.query.companyId;
  const id = req.params.id;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const result = await taxService.getTax({
    companyId,
    id,
  });
  return res.status(200).json({
    status: "success",
    data: result.data,
  });
});

exports.createTax = asyncHandler(async (req, res) => {
  const companyId = req.query.companyId;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const session = await mongoose.startSession();
  session.startTransaction();
  const result = await taxService.createTax({
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

exports.updateTax = asyncHandler(async (req, res) => {
  const companyId = req.query.companyId;
  const id = req.params.id;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const session = await mongoose.startSession();
  session.startTransaction();
  const result = await taxService.updateTax({
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

exports.deleteTax = asyncHandler(async (req, res) => {
  const companyId = req.query.companyId;
  const id = req.params.id;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const session = await mongoose.startSession();
  session.startTransaction();
  const result = await taxService.deleteTax({
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
