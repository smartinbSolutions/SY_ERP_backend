const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const service = require("../../services/Hr/payrollEmployeeLineService");

// ================= CREATE =================
exports.createLine = asyncHandler(async (req, res, next) => {
  try {
    const line = await service.createPayrollEmployeeLine(req.body);

    res.status(201).json({
      status: "success",
      data: line,
    });
  } catch (err) {
    return next(new ApiError(err.message, 400));
  }
});

// ================= BULK CREATE =================
exports.createManyLines = asyncHandler(async (req, res, next) => {
  try {
    const lines = await service.createManyPayrollEmployeeLines(req.body);

    res.status(201).json({
      status: "success",
      results: lines.length,
      data: lines,
    });
  } catch (err) {
    return next(new ApiError(err.message, 400));
  }
});

// ================= GET ALL =================
exports.getLines = asyncHandler(async (req, res, next) => {
  try {
    const lines = await service.getPayrollEmployeeLines(req.query);

    res.status(200).json({
      status: "success",
      results: lines.length,
      data: lines,
    });
  } catch (err) {
    return next(new ApiError(err.message, 400));
  }
});

// ================= GET ONE =================
exports.getLineById = asyncHandler(async (req, res, next) => {
  try {
    const line = await service.getPayrollEmployeeLineById(req.params.id);

    if (!line) {
      return next(new ApiError("Line not found", 404));
    }

    res.status(200).json({
      status: "success",
      data: line,
    });
  } catch (err) {
    return next(new ApiError(err.message, 404));
  }
});

// ================= UPDATE =================
exports.updateLine = asyncHandler(async (req, res, next) => {
  try {
    const updated = await service.updatePayrollEmployeeLine(
      req.params.id,
      req.body
    );

    if (!updated) {
      return next(new ApiError("Line not found", 404));
    }

    res.status(200).json({
      status: "success",
      data: updated,
    });
  } catch (err) {
    return next(new ApiError(err.message, 400));
  }
});

// ================= DELETE =================
exports.deleteLine = asyncHandler(async (req, res, next) => {
  try {
    const result = await service.deletePayrollEmployeeLine(req.params.id);

    if (!result.deletedCount) {
      return next(new ApiError("Line not found", 404));
    }

    res.status(200).json({
      status: "success",
      message: "Deleted successfully",
    });
  } catch (err) {
    return next(new ApiError(err.message, 400));
  }
});

// ================= GET BY PAYROLL EMPLOYEE =================
exports.getByPayrollEmployee = asyncHandler(async (req, res, next) => {
  try {
    const lines = await service.getByPayrollEmployee(req.params.id);

    res.status(200).json({
      status: "success",
      results: lines.length,
      data: lines,
    });
  } catch (err) {
    return next(new ApiError(err.message, 400));
  }
});

// ================= SUMMARY =================
exports.getSummary = asyncHandler(async (req, res, next) => {
  try {
    const summary = await service.getPayrollLinesSummary(
      req.params.payrollPeriodId
    );

    res.status(200).json({
      status: "success",
      data: summary,
    });
  } catch (err) {
    return next(new ApiError(err.message, 400));
  }
});
