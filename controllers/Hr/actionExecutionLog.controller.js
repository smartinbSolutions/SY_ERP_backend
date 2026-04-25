const asyncHandler = require("express-async-handler");
const {
  getActionExecutionLogsService,
} = require("../../services/Hr/actionExecutionLogService");

exports.getActionExecutionLogs = asyncHandler(async (req, res) => {
  const logs = await getActionExecutionLogsService(req.query);

  return res.status(200).json({
    status: "success",
    count: logs.length,
    data: logs,
  });
});
