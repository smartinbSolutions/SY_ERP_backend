const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const approvalFlowService = require("../../services/Hr/approvalFlowService");

// ===== Create Approval Flow =====
exports.createApprovalFlow = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { name, module, steps } = req.body;

  if (!companyId) return next(new ApiError("companyId is required", 400));

  try {
    const flow = await approvalFlowService.createApprovalFlow({
      name,
      module,
      steps,
      companyId,
    });

    res.status(201).json({
      status: "success",
      data: flow,
    });
  } catch (err) {
    return next(new ApiError(err.message, 400));
  }
});

// ===== Get All Approval Flows =====
exports.getAllApprovalFlows = asyncHandler(async (req, res, next) => {
  const { companyId, module } = req.query;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;

  if (!companyId) return next(new ApiError("companyId is required", 400));

  try {
    const flowData = await approvalFlowService.getAllApprovalFlows({
      companyId,
      module,
      page,
      limit,
    });

    res.status(200).json({
      status: "success",
      ...flowData,
    });
  } catch (err) {
    return next(new ApiError(err.message, 400));
  }
});

// ===== Get Single Approval Flow =====
exports.getOneApprovalFlow = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { id } = req.params;

  if (!companyId) return next(new ApiError("companyId is required", 400));

  try {
    const flow = await approvalFlowService.getApprovalFlowById({
      companyId,
      id,
    });
    res.status(200).json({
      status: "success",
      data: flow,
    });
  } catch (err) {
    return next(new ApiError(err.message, 404));
  }
});

// ===== Update Approval Flow =====
exports.updateApprovalFlow = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { id } = req.params;
  const updates = req.body;

  if (!companyId) return next(new ApiError("companyId is required", 400));

  try {
    const flow = await approvalFlowService.updateApprovalFlow({
      companyId,
      id,
      updates,
    });
    res.status(200).json({
      status: "success",
      data: flow,
    });
  } catch (err) {
    return next(new ApiError(err.message, 400));
  }
});

// ===== Delete Approval Flow =====
exports.deleteApprovalFlow = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { id } = req.params;

  if (!companyId) return next(new ApiError("companyId is required", 400));

  try {
    await approvalFlowService.deleteApprovalFlow({ companyId, id });
    res.status(200).json({
      status: "success",
      message: "Approval flow deleted successfully",
    });
  } catch (err) {
    return next(new ApiError(err.message, 404));
  }
});
