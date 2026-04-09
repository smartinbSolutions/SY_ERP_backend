const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const payrollGroupService = require("../../services/Hr/payrollGroupService");

// ===== Create Payroll Group =====
exports.createPayrollGroup = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;

  if (!companyId) return next(new ApiError("companyId is required", 400));

  try {
    const group = await payrollGroupService.createPayrollGroup({
      ...req.body,
      companyId,
    });

    res.status(201).json({
      status: "success",
      data: group,
    });
  } 
  catch (err) {
    return next(new ApiError(err.message, 400));
  }
});

// ===== Get All Payroll Groups =====
exports.getPayrollGroups = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;

  if (!companyId) return next(new ApiError("companyId is required", 400));

  try {
    const groups = await payrollGroupService.getPayrollGroups(companyId);

    res.status(200).json({
      status: "success",
      results: groups.length,
      data: groups,
    });
  }
   catch (err) {
    return next(new ApiError(err.message, 400));
  }
});

// ===== Get Single Payroll Group =====
exports.getPayrollGroupById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  try {
    const group = await payrollGroupService.getPayrollGroupById(id);
    if (!group) return next(new ApiError("Payroll group not found", 404));

    res.status(200).json({
      status: "success",
      data: group,
    });
  }
   catch (err) {
    return next(new ApiError(err.message, 404));
  }
});

// ===== Update Payroll Group =====
exports.updatePayrollGroup = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  try {
    const updated = await payrollGroupService.updatePayrollGroup(id, req.body);

    if (!updated) return next(new ApiError("Payroll group not found", 404));

    res.status(200).json({
      status: "success",
      data: updated,
    });
  } 
  catch (err) {
    return next(new ApiError(err.message, 400));
  }
});

// ===== Delete Payroll Group =====
exports.deletePayrollGroup = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  try {
    const result = await payrollGroupService.deletePayrollGroup(id);

    if (!result) return next(new ApiError("Payroll group not found", 404));

    res.status(200).json({
      status: "success",
      message: "Payroll group deleted successfully",
    });
  }
   catch (err) {
    return next(new ApiError(err.message, 404));
  }
});
