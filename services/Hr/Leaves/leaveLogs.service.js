const leavesLogsModel = require("../../../models/Hr/Leaves/leavesLogsModel");

exports.getMyLeaveLogs = async (userId) => {
  return await leavesLogsModel
    .find({ userId })
    .populate("leaveType")
    .sort({ startDate: -1 });
};

exports.getAllLeaveLogs = async (filter) => {
  return await leavesLogsModel
    .find(filter)
    .populate("userId", "fullName email")
    .populate("leaveType")
    .sort({ startDate: -1 });
};
