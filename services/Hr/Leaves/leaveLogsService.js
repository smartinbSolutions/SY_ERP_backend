const leavesLogsModel = require("../../../models/Hr/Leaves/leavesLogsModel");
const { default: mongoose } = require("mongoose");
const asyncHandler = require("express-async-handler");
const ApiError = require("../../../utils/apiError");

exports.getMyLeaveLogs = asyncHandler(async (req, res, next) => {
  const logs = await leavesLogsModel
    .find({ userId: req.user._id })
    .populate("leaveType")
    .sort({ startDate: -1 });

  res.status(200).json({
    status: true,
    results: logs.length,
    data: logs,
  });
});

exports.getAllLeaveLogs = asyncHandler(async (req, res, next) => {
  const { companyId, userId } = req.query;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  const filter = { companyId };

  if (userId) {
    filter.userId = userId;
  }

  const logs = await leavesLogsModel
    .find(filter)
    .populate("userId", "fullName email")
    .populate("leaveType")
    .sort({ startDate: -1 });

  res.status(200).json({
    status: true,
    results: logs.length,
    data: logs,
  });
});
