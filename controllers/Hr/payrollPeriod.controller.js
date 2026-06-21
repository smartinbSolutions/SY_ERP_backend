const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const payrollPeriodService = require("../../services/Hr/payrollPeriodService");

// ===== Create Payroll Period =====
exports.createPayrollPeriod = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) return next(new ApiError("companyId is required", 400));

  try {
    const period = await payrollPeriodService.createPayrollPeriod({
      ...req.body,
      companyId,
    });

    res.status(201).json({
      status: "success",
      data: period,
    });
  } catch (err) {
    return next(new ApiError(err.message, 400));
  }
});

exports.getSuggestedPayrollPeriod = async (req, res) => {
  const data = await payrollPeriodService.getSuggestedPayrollPeriod(
    req.params.groupId,
  );

  res.json({
    success: true,
    data,
  });
};

// ===== Get All Payroll Periods =====
exports.getPayrollPeriods = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { payrollGroupId } = req.query;

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  try {
    const result = await payrollPeriodService.getPayrollPeriods({
      companyId,
      payrollGroupId,
      page,
      limit,
    });

    res.status(200).json({
      status: "success",
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      results: result.periods.length,
      totalItems: result.total,
      data: result.periods,
    });
  } catch (err) {
    return next(new ApiError(err.message, 400));
  }
});
// ===== Get Single Payroll Period =====
exports.getPayrollPeriodById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  try {
    const period = await payrollPeriodService.getPayrollPeriodById(id);

    if (!period) return next(new ApiError("Payroll period not found", 404));

    res.status(200).json({
      status: "success",
      data: period,
    });
  } catch (err) {
    return next(new ApiError(err.message, 404));
  }
});

// ===== Update Payroll Period =====
exports.updatePayrollPeriod = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  try {
    const updated = await payrollPeriodService.updatePayrollPeriod(
      id,
      req.body,
    );

    if (!updated) return next(new ApiError("Payroll period not found", 404));

    res.status(200).json({
      status: "success",
      data: updated,
    });
  } catch (err) {
    return next(new ApiError(err.message, 400));
  }
});

// ===== Delete Payroll Period =====
exports.deletePayrollPeriod = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  try {
    const result = await payrollPeriodService.deletePayrollPeriod(id);

    if (!result) return next(new ApiError("Payroll period not found", 404));

    res.status(200).json({
      status: "success",
      message: "Payroll period deleted successfully",
    });
  } catch (err) {
    return next(new ApiError(err.message, 404));
  }
});

exports.getPayrollPeriodStaff = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  try {
    const result = await payrollPeriodService.getStaffByPayrollPeriod(id);

    res.status(200).json({
      status: "success",
      results: result.staff.length,
      data: result,
    });
  } catch (err) {
    return next(new ApiError(err.message, 400));
  }
});

// ===== Generate Salary Payroll (NEW) =====
exports.generateSalaryPayroll = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  try {
    const result = await payrollPeriodService.generateSalaryPayroll(id);

    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (err) {
    return next(new ApiError(err.message, 400));
  }
});

exports.getPayrollReview = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  try {
    const result = await payrollPeriodService.getPayrollReview(id);

    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (err) {
    return next(new ApiError(err.message, 400));
  }
});

exports.approvePayrollPeriod = async (req, res) => {
  try {
    const { id } = req.params;

    const period = await payrollPeriodService.approvePayrollPeriod(id);

    res.json({
      success: true,
      data: period,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};
