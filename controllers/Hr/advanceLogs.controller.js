const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const advanceLogsService = require("../../services/Hr/advanceLogsService");

// ================= MY LOGS =================
exports.getMyAdvanceLogs = asyncHandler(async (req, res, next) => {
  const logs = await advanceLogsService.getUserAdvanceLogs(req.user._id);

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

  const logs = await advanceLogsService.getCompanyAdvanceLogs(
    companyId,
    userId,
  );

  res.status(200).json({
    status: true,
    results: logs.length,
    data: logs,
  });
});
