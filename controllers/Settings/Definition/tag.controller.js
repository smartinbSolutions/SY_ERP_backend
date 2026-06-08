const tagService = require("../../../services/Settings/Definition/tag.service");
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");

exports.getTags = asyncHandler(async (req, res) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const result = await tagService.getTags({
    companyId,
  });

  return res.status(200).json({
    status: "success",
    results: result.results,
    data: result.data,
  });
});

exports.getTag = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const id = req.params.id;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const result = await tagService.getTag({
    companyId,
    id,
  });
  return res.status(200).json({
    status: "success",
    data: result.data,
  });
});

exports.createTag = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const session = await mongoose.startSession();
  session.startTransaction();
  const result = await tagService.createTag({
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

exports.updateTag = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const id = req.params.id;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const session = await mongoose.startSession();
  session.startTransaction();
  const result = await tagService.updateTag({
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

exports.deleteTag = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const id = req.params.id;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const session = await mongoose.startSession();
  session.startTransaction();
  const result = await tagService.deleteTag({
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
