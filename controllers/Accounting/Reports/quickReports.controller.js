const asyncHandler = require("express-async-handler");

const {
  getExpensesReportService,
} = require("../../../services/reports/expensesReport.service");
const ApiError = require("../../../utils/apiError");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// shared validation for every quick report
const validateReportQuery = (query, next) => {
  const { startDate, endDate } = query;

  if (startDate && !DATE_RE.test(startDate)) {
    return next(new ApiError("startDate must be YYYY-MM-DD", 400));
  }
  if (endDate && !DATE_RE.test(endDate)) {
    return next(new ApiError("endDate must be YYYY-MM-DD", 400));
  }
  if (startDate && endDate && startDate > endDate) {
    return next(new ApiError("startDate cannot be after endDate", 400));
  }

  return true;
};

// @desc    Expenses quick report (summary, byCategory, byTag, bySupplier)
// @route   GET /api/quickReports/expenses
// @query   startDate, endDate (YYYY-MM-DD), includeTax (true|false), sections (comma list)
exports.getExpensesReport = asyncHandler(async (req, res, next) => {
  if (validateReportQuery(req.query, next) !== true) return;

  const companyId = req.companyId;

  const data = await getExpensesReportService({ req, companyId });

  res.status(200).json({ status: "success", data });
});

// exports.getSalesReport = asyncHandler(async (req, res, next) => { ... });
// exports.getPurchaseReport = asyncHandler(async (req, res, next) => { ... });
