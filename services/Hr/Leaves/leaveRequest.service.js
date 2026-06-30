const LeaveRequest = require("../../../models/Hr/Leaves/leaveRequestModel");
const leaveRequestModel = require("../../../models/Hr/Leaves/leaveRequestModel");
const leavesLogsModel = require("../../../models/Hr/Leaves/leavesLogsModel");
const approvalFlowModel = require("../../../models/Hr/Settings/approvalFlowModel");
const leavesModel = require("../../../models/Hr/Leaves/leaveTypesModel");
const NotificationModel = require("../../../models/Hr/NotificationModel");
const staffModel = require("../../../models/Hr/Staffs/staffModel");

const ApiError = require("../../../utils/apiError");
const { handleApproval } = require("../Settings/approvalService");

const multer = require("multer");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const multerStorage = multer.memoryStorage();

const getRequestDays = (request) => {
  if (
    request.days !== undefined &&
    request.days !== null &&
    Number.isFinite(Number(request.days))
  ) {
    return Number(request.days);
  }

  if (!request.startDate || !request.endDate) return 0;

  const start = new Date(request.startDate);
  const end = new Date(request.endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;

  return Math.max(
    1,
    Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1,
  );
};

const getLeaveTypeAllowance = (leaveType) => {
  switch (leaveType.typeKey) {
    case "annual":
      return leaveType.annualRules?.[0]?.days || 0;

    case "sick":
      return (leaveType.sickRules || []).reduce(
        (total, rule) => total + (Number(rule.days) || 0),
        0,
      );

    case "maternity":
      return (leaveType.maternityRules || []).reduce(
        (total, rule) => total + (Number(rule.days) || 0),
        0,
      );

    default:
      return leaveType.singleRules?.days || 0;
  }
};

const getStaffLeavePolicyId = (staff) =>
  staff.groupId?.leavePolicy?._id ||
  staff.groupId?.leavePolicy ||
  staff.payrollGroupId?.policiesSnapshot?.leavePolicy?._id ||
  staff.payrollGroupId?.policiesSnapshot?.leavePolicy ||
  null;

const attachmentFilter = function (req, file, cb) {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError("File type not allowed", 400), false);
  }
};

const uploadAttachment = multer({
  storage: multerStorage,
  fileFilter: attachmentFilter,
});

exports.uploadLeaveAttachment = uploadAttachment.single("attachment");

exports.processLeaveAttachment = async (req) => {
  if (!req.file) return;

  await fs.promises.mkdir("uploads/leaveAttachments", {
    recursive: true,
  });

  const ext = path.extname(req.file.originalname);
  const filename = `leave-${uuidv4()}-${Date.now()}${ext}`;

  await fs.promises.writeFile(
    `uploads/leaveAttachments/${filename}`,
    req.file.buffer,
  );

  req.body.attachment = filename;
};

exports.createLeaveRequest = async (req) => {
  const { leaveType, startDate, endDate, reason, attachment, days } = req.body;

  if (!req.user) {
    throw new ApiError("Not logged in", 401);
  }

  const requester = await staffModel.findById(req.user._id);

  if (!requester) {
    throw new ApiError("User not found", 404);
  }

  const leave = await leavesModel
    .findById(leaveType)
    .populate("approvalFlow policyId");

  if (!leave) {
    throw new ApiError("Leave type not found", 404);
  }

  const flowId = leave.approvalFlow || leave.policyId?.approvalFlow;

  if (!flowId) {
    throw new ApiError("Approval flow not found", 404);
  }

  const flow = await approvalFlowModel.findById(flowId);

  if (!flow) {
    throw new ApiError("Approval flow not found", 404);
  }

  let approvalSteps = [];

  for (const step of flow.steps) {
    let approverId = null;

    if (step.isDirectManager) {
      const managerId = requester.directManager;

      const managerAlreadyInFlow = flow.steps.some(
        (s) => s.approver?.employeeId?.toString() === managerId?.toString(),
      );

      if (managerId && !managerAlreadyInFlow) {
        approverId = managerId;
      }
    } else if (step.approver?.employeeId) {
      approverId = step.approver.employeeId;

      if (approverId.toString() === requester._id.toString()) {
        approverId = null;
      }
    }

    approvalSteps.push({
      stepNumber: step.stepNumber,
      stepName: step.stepName || "",
      approverId,
      status: approverId ? "pending" : "skipped",
      actedBy: null,
      actedAt: null,
      comment: "",
    });
  }

  const firstPending = approvalSteps.find((s) => s.status === "pending");

  const currentApprover = firstPending?.approverId || null;
  const currentStep = firstPending?.stepNumber || null;

  const newRequest = await LeaveRequest.create({
    userId: requester._id,
    companyId: requester.companyId,
    leaveType,
    startDate,
    endDate,
    reason,
    days,
    attachment: attachment || null,
    approval: {
      flowId: flow._id,
      currentStep,
      currentApprover,
      steps: approvalSteps,
    },
    status: currentApprover ? "pending" : "approved",
    approvedAt: currentApprover ? null : new Date(),
  });

  return newRequest;
};

exports.getMyLeaveRequests = async (req) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const filter = { userId: req.user._id };

  if (req.query.status) {
    filter.status = req.query.status;
  }

  const allRequests = await LeaveRequest.find({
    userId: req.user._id,
  }).select("status startDate endDate days");

  const used = allRequests
    .filter((r) => r.status === "approved")
    .reduce((sum, r) => sum + (r.days || 0), 0);

  const pending = allRequests.filter(
    (request) => request.status === "pending",
  ).length;

  const staff = await staffModel
    .findById(req.user._id)
    .populate({
      path: "groupId",
      select: "leavePolicy",
    })
    .populate({
      path: "payrollGroupId",
      select: "policiesSnapshot.leavePolicy",
    });

  const leavePolicyId = getStaffLeavePolicyId(staff);

  let leaveTypes = [];

  if (leavePolicyId) {
    leaveTypes = await leavesModel.find({
      companyId: staff?.companyId || req.user.companyId,
      policyId: leavePolicyId,
    });
  }

  const totalBalance = leaveTypes.reduce(
    (total, leaveType) => total + getLeaveTypeAllowance(leaveType),
    0,
  );

  const summary = {
    totalBalance,
    used,
    remaining: Math.max(totalBalance - used, 0),
    pending,
  };

  const totalItems = await LeaveRequest.countDocuments(filter);
  const totalPages = Math.ceil(totalItems / limit);

  const requests = await LeaveRequest.find(filter)
    .populate("leaveType")
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  return {
    status: true,
    page,
    totalPages,
    results: requests.length,
    totalItems,
    summary,
    data: requests,
  };
};

exports.getAllLeaveRequests = async (req) => {
  const {
    companyId,
    managerId,
    status,
    leaveType,
    startDate,
    endDate,
    search,
  } = req.query;

  if (!companyId) {
    throw new ApiError("companyId is required", 400);
  }

  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * pageSize;

  const filter = { companyId };

  if (managerId) filter.managerId = managerId;
  if (status) filter.status = status;
  if (leaveType) filter.leaveType = leaveType;
  if (startDate) filter.startDate = { $gte: new Date(startDate) };
  if (endDate) filter.endDate = { $lte: new Date(endDate) };

  let query = LeaveRequest.find(filter)
    .populate("leaveType")
    .populate("userId", "fullName email")
    .skip(skip)
    .limit(pageSize)
    .sort({ createdAt: -1 });

  if (search) {
    const regex = new RegExp(search, "i");

    query = query.populate({
      path: "userId",
      match: { fullName: regex },
      select: "fullName email",
    });
  }

  const totalItems = await LeaveRequest.countDocuments(filter);
  const totalPages = Math.ceil(totalItems / pageSize);

  const requests = await query;

  const filteredRequests = search ? requests.filter((r) => r.userId) : requests;

  return {
    status: true,
    page,
    totalPages,
    results: filteredRequests.length,
    totalItems,
    data: filteredRequests,
  };
};

exports.getLeaveRequestById = async (id) => {
  const request = await LeaveRequest.findById(id);

  if (!request) {
    throw new ApiError("Leave request not found", 404);
  }
  return request;
};

exports.getMyApprovals = async (req) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const { status, startDate, endDate, search } = req.query;

  const filter =
    status && status !== "pending"
      ? {
          "approval.steps.actedBy": req.user._id,
          status,
        }
      : status === "pending"
        ? {
            "approval.currentApprover": req.user._id,
            status: "pending",
          }
        : {
            $or: [
              {
                "approval.currentApprover": req.user._id,
                status: "pending",
              },
              {
                "approval.steps.actedBy": req.user._id,
              },
            ],
          };

  if (startDate || endDate) {
    if (startDate) {
      filter.startDate = {
        $gte: new Date(startDate),
      };
    }

    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);

      filter.endDate = {
        $lte: endOfDay,
      };
    }
  }

  const searchTerm = search?.trim().toLowerCase();

  let requests = await leaveRequestModel
    .find(filter)
    .populate("userId", "fullName email")
    .populate("leaveType")
    .sort({ createdAt: -1 });

  if (searchTerm) {
    requests = requests.filter((request) => {
      const employeeName = request.userId?.fullName?.toLowerCase() || "";

      const employeeEmail = request.userId?.email?.toLowerCase() || "";

      const leaveType = request.leaveType?.typeKey?.toLowerCase() || "";

      return (
        employeeName.includes(searchTerm) ||
        employeeEmail.includes(searchTerm) ||
        leaveType.includes(searchTerm)
      );
    });
  }

  const totalItems = requests.length;
  const paginatedRequests = requests.slice(skip, skip + limit);

  return {
    status: true,
    page,
    limit,
    totalItems,
    totalPages: Math.ceil(totalItems / limit),
    results: paginatedRequests.length,
    data: paginatedRequests,
  };
};
exports.updateLeaveRequest = async (id, body) => {
  const request = await LeaveRequest.findById(id);

  if (!request) {
    throw new ApiError("Leave request not found", 404);
  }

  if (request.status !== "pending") {
    throw new ApiError("Cannot edit a processed request", 400);
  }

  const { leaveType, startDate, endDate, reason, attachment, status } = body;

  request.leaveType = leaveType || request.leaveType;
  request.startDate = startDate || request.startDate;
  request.endDate = endDate || request.endDate;
  request.reason = reason || request.reason;
  request.attachment = attachment || request.attachment;

  if (
    status &&
    ["pending", "approved", "rejected"].includes(status.toLowerCase())
  ) {
    request.status = status.toLowerCase();
  }

  await request.save();

  return request;
};

exports.handleLeaveRequest = async (req) => {
  const { action, reason } = req.body;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const request = await LeaveRequest.findById(req.params.id)
      .populate("approval.flowId")
      .session(session);

    if (!request) {
      await session.abortTransaction();
      session.endSession();
      throw new ApiError("Leave request not found", 404);
    }

    if (request.status !== "pending") {
      await session.abortTransaction();
      session.endSession();
      throw new ApiError("Already processed", 400);
    }

    const { request: updatedRequest } = await handleApproval(
      request,
      req.user._id,
      action,
      reason,
      session,
    );

    if (updatedRequest.status === "approved") {
      const approvedAt = new Date();
      updatedRequest.approvedAt = approvedAt;

      const employee = await staffModel.findById(updatedRequest.userId);

      const employeeSnapshot = {
        name: employee?.fullName || "",
      };

      const leave = await leavesModel.findById(updatedRequest.leaveType);

      if (!leave) {
        await session.abortTransaction();
        session.endSession();
        throw new ApiError("Leave type not found", 404);
      }

      let appliedRule = null;
      let ruleType = null;

      switch (leave.typeKey) {
        case "sick":
          appliedRule = leave.sickRules?.[0];
          ruleType = "sick_rule";
          break;

        case "annual":
          appliedRule = leave.annualRules?.[0];
          ruleType = "annual_rule";
          break;

        case "maternity":
          appliedRule = leave.maternityRules?.[0];
          ruleType = "maternity_rule";
          break;

        case "unpaid":
          appliedRule = {
            payPercentage: 0,
            days: updatedRequest.days,
          };
          ruleType = "unpaid_rule";
          break;

        case "special":
          appliedRule = leave.singleRules;
          ruleType = "single_rule";
          break;

        default:
          appliedRule = null;
          ruleType = "unknown_rule";
      }

      const approvalSnapshot = updatedRequest.approval;

      const leaveSnapshot = {
        typeKey: leave.typeKey,
        requiresAttachment: leave.requiresAttachment,
        rule: appliedRule
          ? {
              name:
                appliedRule.stageName || appliedRule.categoryName || "default",
              days: appliedRule.days,
              payPercentage: appliedRule.payPercentage,
            }
          : null,
      };

      const calculation = {
        totalDays: Number(updatedRequest.days),
        appliedPayPercentage: appliedRule?.payPercentage ?? 0,
        ruleType,
      };

      await leavesLogsModel.create(
        [
          {
            userId: updatedRequest.userId,
            leaveRequestId: updatedRequest._id,
            companyId: updatedRequest.companyId,
            leaveType: updatedRequest.leaveType,

            leaveSnapshot,
            calculation,
            approvalSnapshot,
            employeeSnapshot,

            startDate: updatedRequest.startDate,
            endDate: updatedRequest.endDate,

            approvedBy: req.user._id,
            approvedAt,

            managerComment: reason || "",
          },
        ],
        { session },
      );

      await updatedRequest.save({ session });

      console.log("Leave log created:", updatedRequest._id);
    }

    await NotificationModel.create(
      [
        {
          recipient: updatedRequest.userId,
          actor: req.user._id,
          title: `Leave ${
            updatedRequest.status.charAt(0).toUpperCase() +
            updatedRequest.status.slice(1)
          }`,
          message: `Your leave request status changed to ${updatedRequest.status}`,
          entity: {
            id: updatedRequest._id,
            model: "LeaveRequest",
          },
        },
      ],
      { session },
    );

    await session.commitTransaction();
    session.endSession();

    return updatedRequest;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    console.error("Transaction error in handleLeaveRequest:", err);

    throw new ApiError(err.message, 400);
  }
};

exports.deleteLeaveRequest = async (id) => {
  const request = await LeaveRequest.findById(id);

  if (!request) {
    throw new ApiError("Leave request not found", 404);
  }

  await LeaveRequest.deleteOne({
    _id: request._id,
  });
};
