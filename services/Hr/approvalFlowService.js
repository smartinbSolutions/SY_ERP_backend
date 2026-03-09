const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const { default: mongoose } = require("mongoose");
const ApprovalFlow = require("../../models/Hr/approvalFlowModel");

//  Validation Function
const validateApprovalSteps = (steps) => {
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error("Approval flow must contain at least one step");
  }

  const stepNumbers = new Set();

  for (const step of steps) {
    if (!step.stepNumber) {
      throw new Error("Each step must have a stepNumber");
    }

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

//  Create Approval Flow
exports.createApprovalFlow = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { name, module, steps } = req.body;

  if (!companyId) return next(new ApiError("companyId is required", 400));

  try {
    if (req.body.steps) validateApprovalSteps(req.body.steps);
  } catch (err) {
    return next(new ApiError(err.message, 400));
  }

  const flow = await ApprovalFlow.create({
    name,
    module,
    steps,
    companyId,
  });
  res.status(201).json({
    status: "success",
    data: flow,
  });
});

//  Get All Approval Flows
exports.getAllApprovalFlows = asyncHandler(async (req, res, next) => {
  const { companyId, module } = req.query;

  if (!companyId) return next(new ApiError("companyId is required", 400));

  const query = { companyId };
  if (module) query.module = module;

  const flows = await ApprovalFlow.find(query).sort({ createdAt: -1 });

  res.status(200).json({
    status: "success",
    results: flows.length,
    data: flows,
  });
});

//  Get Single Approval Flow
exports.getOneApprovalFlow = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { id } = req.params;

  if (!companyId) return next(new ApiError("companyId is required", 400));
  if (!mongoose.Types.ObjectId.isValid(id))
    return next(new ApiError("Invalid ID format", 400));

  const flow = await ApprovalFlow.findOne({ _id: id, companyId });

  if (!flow)
    return next(new ApiError(`No approval flow found with ID: ${id}`, 404));

  res.status(200).json({
    status: "success",
    data: flow,
  });
});

//  Update Approval Flow
exports.updateApprovalFlow = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { id } = req.params;

  if (!companyId) return next(new ApiError("companyId is required", 400));
  if (!mongoose.Types.ObjectId.isValid(id))
    return next(new ApiError("Invalid ID format", 400));

  try {
    if (req.body.steps) validateApprovalSteps(req.body.steps);
  } catch (err) {
    return next(new ApiError(err.message, 400));
  }

  const flow = await ApprovalFlow.findOneAndUpdate(
    { _id: id, companyId },
    req.body,
    { new: true, runValidators: true },
  );

  if (!flow) return next(new ApiError("Approval flow not found", 404));

  res.status(200).json({
    status: "success",
    data: flow,
  });
});

//  Delete Approval Flow
exports.deleteApprovalFlow = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { id } = req.params;

  if (!companyId) return next(new ApiError("companyId is required", 400));
  if (!mongoose.Types.ObjectId.isValid(id))
    return next(new ApiError("Invalid ID format", 400));

  const flow = await ApprovalFlow.findOneAndDelete({ _id: id, companyId });

  if (!flow) return next(new ApiError("Approval flow not found", 404));

  res.status(200).json({
    status: "success",
    message: "Approval flow deleted successfully",
  });
});
