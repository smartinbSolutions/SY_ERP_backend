const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const payrollPeriodService = require("../../services/Hr/payrollPeriodService");

// ===== Create Payroll Period =====
exports.createPayrollPeriod = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;

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

// ===== Get All Payroll Periods =====
exports.getPayrollPeriods = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;

  if (!companyId) return next(new ApiError("companyId is required", 400));

  try {
    const periods = await payrollPeriodService.getPayrollPeriods({
      companyId,
    });

    res.status(200).json({
      status: "success",
      results: periods.length,
      data: periods,
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

// ===== Generate Payroll 🔥 =====
exports.generatePayroll = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  try {
    const payrolls = await payrollPeriodService.generatePayrollForPeriod(id);

    res.status(200).json({
      status: "success",
      results: payrolls.length,
      data: payrolls,
    });
  } catch (err) {
    return next(new ApiError(err.message, 400));
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
    // console.log(result);
    // const attendanceObj = Object.fromEntries(result.context.attendanceMap);
    res.status(200).json({
      status: "success",
      data: result,
      // attendanceMap: attendanceObj,
    });
  } catch (err) {
    return next(new ApiError(err.message, 400));
  }
});
