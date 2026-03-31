const e = require("express");
const ApprovalFlow = require("../../models/Hr/approvalFlowModel");
const { default: mongoose } = require("mongoose");

// ===== Validation Function =====
const validateApprovalSteps = (steps) => {
  const stepNumbers = new Set();
  let directManagerCount = 0;

  for (const step of steps) {
    if (!step.stepNumber) {
      throw new Error("Each step must have a stepNumber");
    }

    if (stepNumbers.has(step.stepNumber)) {
      throw new Error(`Duplicate stepNumber: ${step.stepNumber}`);
    }

    stepNumbers.add(step.stepNumber);

    if (step.isDirectManager) {
      directManagerCount++;
      continue; 
    }

    if (!step.approver) {
      throw new Error(`Approver is required for step ${step.stepNumber}`);
    }

    const { employeeId, positionId } = step.approver;

    if (!employeeId || !positionId) {
      throw new Error(
        `Both employeeId and positionId are required in step ${step.stepNumber}`,
      );
    }
  }

  if (directManagerCount > 1) {
    throw new Error("Only one direct manager step is allowed");
  }
};

// ===== Create Approval Flow =====
exports.createApprovalFlow = async ({ name, companyId, steps }) => {
  validateApprovalSteps(steps);
  const flow = await ApprovalFlow.create({
    name,
    companyId,
    steps,
  });

  return flow;
};

exports.getAllApprovalFlows = async ({
  companyId,
  module,
  page = 1,
  limit = 10,
  keyword,
}) => {
  const query = { companyId };
  if (module) query.module = module;
  if (keyword) {
    query.name = { $regex: keyword, $options: "i" };
  }

  const pageNumber = parseInt(page, 10);
  const pageLimit = parseInt(limit, 10);
  const skip = (pageNumber - 1) * pageLimit;

  const totalResults = await ApprovalFlow.countDocuments(query);

  const flows = await ApprovalFlow.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(pageLimit)
    .populate({
      path: "steps.approver.employeeId",
      select: "fullName ",
    })
    .populate({
      path: "steps.approver.positionId",
      select: "name",
    });
  // .populate("Positions", "name");

  return {
    page: pageNumber,
    limit: pageLimit,
    totalPages: Math.ceil(totalResults / pageLimit),
    totalResults,
    results: flows.length,
    data: flows,
  };
};

// ===== Get Single Approval Flow =====
exports.getApprovalFlowById = async ({ companyId, id }) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error("Invalid ID format");
  }

  const flow = await ApprovalFlow.findOne({ _id: id, companyId })
    .populate({
      path: "steps.approver.employeeId",
      select: "fullName ",
    })
    .populate({
      path: "steps.approver.positionId",
      select: "name",
    });
  if (!flow) throw new Error(`No approval flow found with ID: ${id}`);
  return flow;
};

// ===== Update Approval Flow =====
exports.updateApprovalFlow = async ({ id, companyId, updates }) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error("Invalid ID format");
  }

  if (updates.steps) {
    validateApprovalSteps(updates.steps);
  }

  const flow = await ApprovalFlow.findOneAndUpdate(
    { _id: id, companyId },
    updates,
    { new: true, runValidators: true },
  );

  if (!flow) throw new Error("Approval flow not found");

  return flow;
};

// ===== Delete Approval Flow =====
exports.deleteApprovalFlow = async ({ companyId, id }) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error("Invalid ID format");
  }

  const flow = await ApprovalFlow.findOneAndDelete({ _id: id, companyId });
  if (!flow) throw new Error("Approval flow not found");
  return flow;
};
