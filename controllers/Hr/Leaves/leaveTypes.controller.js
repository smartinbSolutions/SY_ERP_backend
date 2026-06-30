const asyncHandler = require("express-async-handler");
const leaveService = require("../../../services/Hr/Leaves/leaveTypes.service");

// GET ALL
exports.getAllLeaves = asyncHandler(async (req, res, next) => {
  const result = await leaveService.getAllLeaves(req);

  res.status(200).json(result);
});

// GET ONE
exports.getOneLeave = asyncHandler(async (req, res, next) => {
  const leave = await leaveService.getOneLeave(req);

  res.status(200).json({
    status: "success",
    data: leave,
  });
});

// CREATE
exports.createLeave = asyncHandler(async (req, res, next) => {
  const leave = await leaveService.createLeave(req);

  res.status(201).json({
    status: "success",
    data: leave,
  });
});

// UPDATE
exports.updateLeave = asyncHandler(async (req, res, next) => {
  const leave = await leaveService.updateLeave(req);

  res.status(200).json({
    status: "success",
    data: leave,
  });
});

// DELETE
exports.deleteLeave = asyncHandler(async (req, res, next) => {
  const message = await leaveService.deleteLeave(req);

  res.status(200).json({
    status: "success",
    message,
  });
});
