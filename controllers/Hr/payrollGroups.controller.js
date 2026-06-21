const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const payrollGroupService = require("../../services/Hr/payrollGroupService");

// ================= CREATE =================
exports.createPayrollGroup = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  const group = await payrollGroupService.createPayrollGroup({
    ...req.body,
    companyId,
  });

  res.status(201).json({
    status: "success",
    data: group,
  });
});

// ================= GET ALL =================
exports.getPayrollGroups = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  const groups = await payrollGroupService.getPayrollGroups(companyId);

  res.status(200).json({
    status: "success",
    results: groups.length,
    data: groups,
  });
});

// ================= GET ONE =================
exports.getPayrollGroupById = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  const group = await payrollGroupService.getPayrollGroupById(companyId, id);

  res.status(200).json({
    status: "success",
    data: group,
  });
});

// ================= UPDATE =================
exports.updatePayrollGroup = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  const updated = await payrollGroupService.updatePayrollGroup(
    companyId,
    id,
    req.body,
  );

  res.status(200).json({
    status: "success",
    data: updated,
  });
});

// ================= DELETE =================
exports.deletePayrollGroup = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  await payrollGroupService.deletePayrollGroup(companyId, id);

  res.status(200).json({
    status: "success",
    message: "Payroll group deleted successfully",
  });
});
