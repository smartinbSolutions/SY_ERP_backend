const AdvanceLog = require("../../../models/Hr/Advance/advanceLogsModel");

// ===== USER LOGS =====
exports.getUserAdvanceLogs = async (userId) => {
  return await AdvanceLog.find({ userId })
    .populate("advanceTypeId")
    .populate("approvedBy", "fullName email")
    .populate("advanceRequestId")
    .sort({ createdAt: -1 });
};

// ===== COMPANY LOGS =====
exports.getCompanyAdvanceLogs = async (companyId, userId) => {
  const filter = { companyId };

  if (userId) {
    filter.userId = userId;
  }

  return await AdvanceLog.find(filter)
    .populate("userId", "fullName email")
    .populate("approvedBy", "fullName email")
    .populate("advanceTypeId")
    .populate("advanceRequestId")
    .sort({ createdAt: -1 });
};