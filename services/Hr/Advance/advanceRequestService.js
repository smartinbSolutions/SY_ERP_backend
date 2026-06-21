const AdvanceRequest = require("../../../models/Hr/Advance/advanceRequestModel");
const advanceLogsModel = require("../../../models/Hr/Advance/advanceLogsModel");
const approvalFlowModel = require("../../../models/Hr/approvalFlowModel");
const advanceTypesModel = require("../../../models/Hr/Advance/advanceTypesModel");
const { default: mongoose } = require("mongoose");
const { handleApproval } = require("../approvalService");
const NotificationModel = require("../../../models/Hr/NotificationModel");
const staffModel = require("../../../models/Hr/staffModel");
const payrollPeriodModel = require("../../../models/Hr/payrollPeriodModel");

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
exports.getMyApprovals = async ({
  userId,
  page = 1,
  limit = 10,
  status,
  search,
}) => {
  const skip = (page - 1) * limit;
  const filter =
    status && status !== "pending"
      ? { "approval.steps.actedBy": userId, status }
      : status === "pending"
        ? { "approval.currentApprover": userId, status: "pending" }
        : {
            $or: [
              { "approval.currentApprover": userId, status: "pending" },
              { "approval.steps.actedBy": userId },
            ],
          };

  const searchTerm = search?.trim().toLowerCase();

  let requests = await AdvanceRequest.find(filter)
    .populate("userId", "fullName email")
    .populate("advanceTypeId")
    .sort({ createdAt: -1 });

  if (searchTerm) {
    requests = requests.filter((request) => {
      const employeeName = request.userId?.fullName?.toLowerCase() || "";
      const employeeEmail = request.userId?.email?.toLowerCase() || "";
      const advanceType = request.advanceTypeId?.typeKey?.toLowerCase() || "";

      return (
        employeeName.includes(searchTerm) ||
        employeeEmail.includes(searchTerm) ||
        advanceType.includes(searchTerm)
      );
    });
  }

  const totalItems = requests.length;
  const paginatedRequests = requests.slice(skip, skip + limit);

  return {
    page,
    limit,
    totalItems,
    totalPages: Math.ceil(totalItems / limit),
    requests: paginatedRequests,
  };
};

// ================= HANDLE APPROVAL =================
exports.handleApprovalTransaction = async (
  request,
  userId,
  action,
  reason,
  session,
) => {
  try {
    console.log("➡️ [ADVANCE APPROVAL] START");
    console.log("📌 Request ID:", request._id);
    console.log("👤 User ID:", userId);
    console.log("⚙️ Action:", action);

    // =========================
    // STEP 1: APPROVAL ENGINE
    // =========================
    const updatedRequest = await handleApproval(
      request,
      userId,
      action,
      reason,
      session,
    );

    console.log("✅ STEP 1 DONE");
    console.log("📊 Status:", updatedRequest.status);

    // =========================
    // STEP 2: FETCH FRESH REQUEST
    // =========================
    const freshRequest = await AdvanceRequest.findById(request._id)
      .populate("advanceTypeId")
      .session(session);

    if (!freshRequest) {
      throw new Error("Advance request not found after approval");
    }

    const advanceType = freshRequest.advanceTypeId;

    if (!advanceType) {
      throw new Error("Advance type not found for this request");
    }

    // =========================
    // STEP 3: EMPLOYEE DATA
    // =========================
    const employee = await staffModel
      .findById(freshRequest.userId)
      .session(session);

    const salarySnapshot = employee?.salary || 0;

    // =========================
    // STEP 4: RULE SNAPSHOT
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
    // STEP 5: CALCULATIONS
    // =========================
    const requestedAmount = Number(freshRequest.amount);

    const maxAllowedAmount =
      (salarySnapshot * (advanceType.maxPercentageOfSalary || 100)) / 100;

    const approvedAmount = Math.min(requestedAmount, maxAllowedAmount);

    const appliedPercentageOfSalary =
      salarySnapshot > 0 ? (approvedAmount / salarySnapshot) * 100 : 0;

    const installments = advanceType.allowInstallments
      ? freshRequest.installments || 0
      : 0;

    const installmentAmount =
      installments > 0 ? approvedAmount / installments : null;

    const calculation = {
      requestedAmount,
      approvedAmount,
      salarySnapshot,
      appliedPercentageOfSalary,
      installments,
      installmentAmount,
      remainingAfterApproval: salarySnapshot - approvedAmount,
    };

    console.log("📊 Calculation:", calculation);

    // =========================
    // STEP 6: CREATE LOG
    // =========================
    if (freshRequest.status === "approved") {
      console.log("✅ FINAL APPROVAL → creating log");

      // -------------------------
      // NEW: determine first deduction date
      // -------------------------
      const nextPeriod = await payrollPeriodModel
        .findOne({
          payrollGroupId: employee.payrollGroupId,
          companyId: freshRequest.companyId,
          startDate: { $gt: freshRequest.approvedAt },
        })
        .sort({ startDate: 1 });

      const firstDeductionDate =
        nextPeriod?.startDate || freshRequest.approvedAt;

      // ensure approvedAt exists
      if (!freshRequest.approvedAt) {
        freshRequest.approvedAt = new Date();
      }

      const logPayload = {
        userId: freshRequest.userId,
        advanceRequestId: freshRequest._id,
        advanceTypeId: advanceType._id,
        companyId: freshRequest.companyId,

        ruleSnapshot,

        calculation,

        // NEW FIELD
        repayment: {
          firstDeductionDate,
        },

        approvedBy: userId,
        approvedAt: freshRequest.approvedAt,
        managerComment: reason || "",
      };

      console.log("🧾 LOG PAYLOAD:", logPayload);

      await advanceLogsModel.create([logPayload], { session });

      console.log("✅ LOG CREATED");

      await freshRequest.save({ session });

      console.log("💾 REQUEST SAVED");
    } else {
      console.log("⏭️ Not final approval → skipping log");
    }

    // =========================
    // STEP 7: NOTIFICATION
    // =========================
    await NotificationModel.create(
      [
        {
          recipient: freshRequest.userId,
          actor: userId,
          title: `Advance ${
            freshRequest.status.charAt(0).toUpperCase() +
            freshRequest.status.slice(1)
          }`,
          message: `Your advance request status changed to ${freshRequest.status}`,
          entity: {
            id: freshRequest._id,
            model: "AdvanceRequest",
          },
        },
      ],
      { session },
    );

    console.log("📨 Notification sent");

    return freshRequest;
  } catch (err) {
    console.error("🔥 ADVANCE APPROVAL ERROR:", err);
    throw err;
  }
};
