const AdvanceLog = require("../../models/Hr/advanceLogsModel");
const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");

// ================= MY LOGS =================
exports.getMyAdvanceLogs = asyncHandler(async (req, res, next) => {
  const logs = await AdvanceLog.find({ userId: req.user._id })
    .populate("advanceTypeId")
    .populate("approvedBy", "fullName email")
    .populate("advanceRequestId")
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: true,
    results: logs.length,
    data: logs,
  });
});

// ================= COMPANY LOGS =================
exports.getAllAdvanceLogs = asyncHandler(async (req, res, next) => {
  const { companyId, userId } = req.query;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  const filter = { companyId };

  if (userId) {
    filter.userId = userId;
  }

  const logs = await AdvanceLog.find(filter)
    .populate("userId", "fullName email")
    .populate("approvedBy", "fullName email")
    .populate("advanceTypeId")
    .populate("advanceRequestId")
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: true,
    results: logs.length,
    data: logs,
  });
});
