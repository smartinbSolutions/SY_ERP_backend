const AdvanceRequest = require("../../models/Hr/advanceRequestModel");
const advanceLogsModel = require("../../models/Hr/advanceLogsModel");
const approvalFlowModel = require("../../models/Hr/approvalFlowModel");
const advanceTypesModel = require("../../models/Hr/advanceTypesModel");
const { default: mongoose } = require("mongoose");
const { handleApproval } = require("./approvalService");

// ================= CREATE =================
exports.createAdvanceRequest = async (data) => {
  return await AdvanceRequest.create(data);
};

// ================= FIND TYPE =================
exports.getAdvanceTypeById = async (advanceTypeId) => {
  return await advanceTypesModel.findById(advanceTypeId).populate("policyId");
};

// ================= FIND FLOW =================
exports.getApprovalFlowById = async (flowId) => {
  return await approvalFlowModel.findById(flowId);
};

// ================= GET MY REQUESTS =================
exports.getMyRequests = async (userId) => {
  return await AdvanceRequest.find({ userId })
    .populate("advanceTypeId")
    .sort({ createdAt: -1 });
};

// ================= GET COMPANY REQUESTS =================
exports.getCompanyRequests = async (companyId, skip, limit) => {
  const total = await AdvanceRequest.countDocuments({ companyId });
  const requests = await AdvanceRequest.find({ companyId })
    .populate("userId", "fullName email")
    .populate("advanceTypeId")
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  return { requests, total };
};

// ================= GET ONE =================
exports.getById = async (id) => {
  return await AdvanceRequest.findById(id)
    .populate("userId", "fullName email")
    .populate("advanceTypeId");
};

// ================= UPDATE =================
exports.saveRequest = async (request) => {
  return await request.save();
};

// ================= DELETE =================
exports.deleteById = async (id) => {
  return await AdvanceRequest.deleteOne({ _id: id });
};

// ================= GET MY APPROVALS =================
exports.getMyApprovals = async (userId) => {
  return await AdvanceRequest.find({
    "approval.currentApprover": userId,
    status: "pending",
  })
    .populate("userId", "fullName email")
    .populate("advanceTypeId")
    .sort({ createdAt: -1 });
};

// ================= HANDLE APPROVAL =================
exports.handleApprovalTransaction = async (
  request,
  userId,
  action,
  reason,
  session,
) => {
  const updatedRequest = await handleApproval(
    request,
    userId,
    action,
    reason,
    session,
  );

  if (updatedRequest.status === "approved") {
    if (!updatedRequest.approvedAt) updatedRequest.approvedAt = new Date();

    await advanceLogsModel.create(
      [
        {
          userId: updatedRequest.userId,
          advanceRequestId: updatedRequest._id,
          advanceTypeId: updatedRequest.advanceTypeId,
          salarySnapshot: updatedRequest.salarySnapshot,
          approvedAmount: updatedRequest.amount,
          installments: updatedRequest.installments || null,
          installmentAmount: updatedRequest.installmentAmount || null,
          approvedBy: userId,
          approvedAt: updatedRequest.approvedAt,
          managerComment: reason || "",
          companyId: updatedRequest.companyId,
        },
      ],
      { session },
    );

    await updatedRequest.save({ session });
  }

  return updatedRequest;
};
