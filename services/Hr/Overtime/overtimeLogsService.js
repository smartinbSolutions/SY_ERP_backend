const OvertimeLog = require("../../../models/Hr/Overtime/overtimeLogsModel");
const asyncHandler = require("express-async-handler");
const ApiError = require("../../../utils/apiError");

// ================= MY LOGS =================

exports.getMyOvertimeLogs = asyncHandler(async (req, res, next) => {
  const logs = await OvertimeLog.find({ userId: req.user._id })
    .populate("overtimeType")
    .populate("approvedBy", "fullName email")
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: true,
    results: logs.length,
    data: logs,
  });
});

// ================= COMPANY LOGS =================

exports.getAllOvertimeLogs = asyncHandler(async (req, res, next) => {
  const { companyId, userId } = req.query;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  const filter = { companyId };

  if (userId) {
    filter.userId = userId;
  }

  const logs = await OvertimeLog.find(filter)
    .populate("userId", "fullName email")
    .populate("approvedBy", "fullName email")
    .populate("overtimeType")
    .populate("overtimeRequestId")
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: true,
    results: logs.length,
    data: logs,
  });
});
