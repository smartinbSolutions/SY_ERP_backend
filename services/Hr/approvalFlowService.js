const ApprovalFlow = require("../../models/Hr/approvalFlowModel");
const { default: mongoose } = require("mongoose");

// ===== Validation Function =====
const validateApprovalSteps = (steps) => {
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error("Approval flow must contain at least one step");
  }

  const stepNumbers = new Set();

  for (const step of steps) {
    if (!step.stepNumber) throw new Error("Each step must have a stepNumber");

    if (stepNumbers.has(step.stepNumber)) {
      throw new Error(`Duplicate stepNumber: ${step.stepNumber}`);
    }

    stepNumbers.add(step.stepNumber);

    if (!step.approver) {
      throw new Error(`Approver is required for step ${step.stepNumber}`);
    }

    const { employeeId, positionId } = step.approver;

    if (!employeeId) {
      throw new Error(
        `employeeId is required in approver for step ${step.stepNumber}`,
      );
    }

    if (!positionId) {
      throw new Error(
        `positionId is required in approver for step ${step.stepNumber}`,
      );
    }
  }
};

// ===== Create Approval Flow =====
const createApprovalFlow = async ({ name, module, steps, companyId }) => {
  validateApprovalSteps(steps);
  const flow = await ApprovalFlow.create({ name, module, steps, companyId });
  return flow;
};

const getAllApprovalFlows = async ({
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
const getApprovalFlowById = async ({ companyId, id }) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error("Invalid ID format");
  }

  const flow = await ApprovalFlow.findOne({ _id: id, companyId }).populate({
    path: "steps.approver.employeeId",
    select: "fullName ",
  }).populate({
    path: "steps.approver.positionId",
    select: "name",
  });
  if (!flow) throw new Error(`No approval flow found with ID: ${id}`);
  return flow;
};

// ===== Update Approval Flow =====
const updateApprovalFlow = async ({ companyId, id, updates }) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error("Invalid ID format");
  }

  if (updates.steps) validateApprovalSteps(updates.steps);

  // Prevent changing companyId
  delete updates.companyId;

  const flow = await ApprovalFlow.findOneAndUpdate(
    { _id: id, companyId },
    updates,
    { new: true, runValidators: true },
  );

  if (!flow) throw new Error("Approval flow not found");
  return flow;
};

// ===== Delete Approval Flow =====
const deleteApprovalFlow = async ({ companyId, id }) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error("Invalid ID format");
  }

  const flow = await ApprovalFlow.findOneAndDelete({ _id: id, companyId });
  if (!flow) throw new Error("Approval flow not found");
  return flow;
};

module.exports = {
  createApprovalFlow,
  getAllApprovalFlows,
  getApprovalFlowById,
  updateApprovalFlow,
  deleteApprovalFlow,
};
