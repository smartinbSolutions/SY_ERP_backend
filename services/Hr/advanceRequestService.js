const AdvanceRequest = require("../../models/Hr/advanceRequestModel");
const advanceLogsModel = require("../../models/Hr/advanceLogsModel");
const approvalFlowModel = require("../../models/Hr/approvalFlowModel");
const advanceTypesModel = require("../../models/Hr/advanceTypesModel");
const { default: mongoose } = require("mongoose");
const { handleApproval } = require("./approvalService");
const NotificationModel = require("../../models/Hr/NotificationModel");

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

  // =========================
  // POPULATE TYPE
  // =========================
  await updatedRequest.populate("advanceTypeId");

  const advanceType = updatedRequest.advanceTypeId;

  // =========================
  // GET EMPLOYEE (SALARY)
  // =========================
  const staffModel = require("../../models/Hr/staffModel");

  const employee = await staffModel
    .findById(updatedRequest.userId)
    .session(session);

  const salarySnapshot = employee?.salary || 0;

  // =========================
  // RULE SNAPSHOT
  // =========================
  const ruleSnapshot = {
    typeKey: advanceType.typeKey,
    maxPercentageOfSalary: advanceType.maxPercentageOfSalary,
    allowInstallments: advanceType.allowInstallments,
    maxMonthsInstallments: advanceType.maxMonthsInstallments,
    maxInstallmentPercentage: advanceType.maxInstallmentPercentage,
    minMonthsAfterJoin: advanceType.minMonthsAfterJoin,
  };

  // =========================
  // CALCULATION
  // =========================
  const requestedAmount = updatedRequest.amount;

  const maxAllowedAmount =
    (salarySnapshot * (advanceType.maxPercentageOfSalary || 100)) / 100;

  const approvedAmount = Math.min(requestedAmount, maxAllowedAmount);

  const appliedPercentageOfSalary =
    salarySnapshot > 0 ? (approvedAmount / salarySnapshot) * 100 : 0;

  const installments = updatedRequest.installments || null;

  const installmentAmount =
    installments && installments > 0 ? approvedAmount / installments : null;

  const calculation = {
    requestedAmount,
    approvedAmount,
    salarySnapshot,
    appliedPercentageOfSalary,
    installments,
    installmentAmount,
    remainingAfterApproval: salarySnapshot - approvedAmount,
  };

  // =========================
  // CREATE LOG (ONLY IF APPROVED)
  // =========================
  if (updatedRequest.status === "approved") {
    if (!updatedRequest.approvedAt) {
      updatedRequest.approvedAt = new Date();
    }

    await advanceLogsModel.create(
      [
        {
          userId: updatedRequest.userId,
          advanceRequestId: updatedRequest._id,
          advanceTypeId: advanceType._id,

          companyId: updatedRequest.companyId,

          ruleSnapshot,
          calculation,

          approvedBy: userId,
          approvedAt: updatedRequest.approvedAt,
          managerComment: reason || "",
        },
      ],
      { session },
    );

    await updatedRequest.save({ session });
  }

  // =========================
  // NOTIFICATION
  // =========================
  await NotificationModel.create(
    [
      {
        recipient: updatedRequest.userId,
        actor: userId,
        title: `Advance ${
          updatedRequest.status.charAt(0).toUpperCase() +
          updatedRequest.status.slice(1)
        }`,
        message: `Your advance request status changed to ${updatedRequest.status}`,
        entity: {
          id: updatedRequest._id,
          model: "AdvanceRequest",
        },
      },
    ],
    { session },
  );

  return updatedRequest;
};
