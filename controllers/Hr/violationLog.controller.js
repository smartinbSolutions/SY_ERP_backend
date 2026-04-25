const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const mongoose = require("mongoose");

const {
  getAllViolationLogsService,
  getViolationTotalsService,
  deleteViolationLogService,
} = require("../../services/Hr/violationLogsService");

/* =====================================================
   GET ALL
===================================================== */
exports.getAllViolationLogs = asyncHandler(async (req, res, next) => {
  const { companyId, userId, violationType, page, limit } = req.query;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  const result = await getAllViolationLogsService({
    companyId,
    userId,
    violationType,
    page,
    limit,
  });

  res.status(200).json({
    status: "success",
    ...result,
  });
});

/* =====================================================
   GET TOTALS
===================================================== */
exports.getViolationTotals = asyncHandler(async (req, res, next) => {
  const { userId, companyId, from, to } = req.query;

  if (!userId || !companyId || !from || !to) {
    return next(new ApiError("Missing required params", 400));
  }

  const result = await getViolationTotalsService({
    userId,
    companyId,
    from,
    to,
  });

  res.status(200).json({
    status: "success",
    period: { from, to },
    totalLogs: result.logs.length,
    totals: result.totals,
    logs: result.logs,
  });
});

/* =====================================================
   DELETE
===================================================== */
exports.deleteViolationLog = asyncHandler(async (req, res, next) => {
  const { companyId } = req.query;
  const { id } = req.params;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ApiError("Invalid ID format", 400));
  }

  const doc = await deleteViolationLogService({ id, companyId });

  if (!doc) {
    return next(new ApiError("Violation log not found", 404));
  }

  res.status(200).json({
    status: "success",
    message: "Deleted successfully",
  });
});
