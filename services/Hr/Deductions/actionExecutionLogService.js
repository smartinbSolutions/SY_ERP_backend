const ActionExecutionLog = require("../../../models/Hr/Deductions/actionExecutionLogModel");

const getActionExecutionLogsService = async ({
  userId,
  companyId,
  actionType,
  violationType,
  from,
  to,
}) => {
  const query = { companyId };

  if (userId) query.userId = userId;
  if (actionType) query.actionType = actionType;
  if (violationType) query.violationType = violationType;

  if (from && to) {
    query.periodStart = {
      $gte: new Date(from),
      $lte: new Date(to),
    };
  }

  return await ActionExecutionLog.find(query).sort({ createdAt: -1 }).lean();
};

module.exports = {
  getActionExecutionLogsService,
};
