const asyncHandler = require("express-async-handler");
const ApiError = require("../../../utils/apiError");
const leaveLogsService = require("../../../services/Hr/Leaves/leaveLogs.service");

exports.getMyLeaveLogs = asyncHandler(async (req, res, next) => {
  const logs = await leaveLogsService.getMyLeaveLogs(req.user._id);

  res.status(200).json({
    status: true,
    results: logs.length,
    data: logs,
  });
});

exports.getAllLeaveLogs = asyncHandler(async (req, res, next) => {
  const { userId } = req.query;
  const companyId = req.companyId;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  const filter = { companyId };

  if (userId) {
    filter.userId = userId;
  }

  const logs = await leaveLogsService.getAllLeaveLogs(filter);

  res.status(200).json({
    status: true,
    results: logs.length,
    data: logs,
  });
});
