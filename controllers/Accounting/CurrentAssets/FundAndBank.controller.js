const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const {
  findAllFundAndBankService,
  findOneFundAndBankService,
  createFundAndBankService,
  deleteFundAndBankService,
  updateFundAndBankService,
  getFundAndBankForSalesPointService,
  findSpecificFundReportsService,
  createFundAdjustmentService,
} = require("../../../services/Accounting/CurrentAssets/Funds/FundAndBanck.service");

exports.findAllFundAndBank = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const { fundAndBanks, totalItems } = await findAllFundAndBankService({
    req,
    companyId,
  });

  res.status(200).json({
    status: "true",
    results: totalItems,
    data: fundAndBanks,
  });
});

exports.createFundAndBank = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const session = await mongoose.startSession();

  try {
    let result;
    await session.withTransaction(async () => {
      req.body.companyId = companyId;
      result = await createFundAndBankService({ req, companyId, session });
    });

    res.status(201).json({
      status: "success",
      data: result.fundAndBank,
    });
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
  }
});

exports.createFundAdjustment = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const session = await mongoose.startSession();

  try {
    let result;
    await session.withTransaction(async () => {
      // Take fundId from URL, not body — single source of truth
      req.body.fundId = req.params.id;
      result = await createFundAdjustmentService({ req, companyId, session });
    });

    res.status(201).json({
      status: "success",
      message: "Adjustment recorded",
      data: result,
    });
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
  }
});

exports.findOneFundAndBank = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const { fundAndBank } = await findOneFundAndBankService({
    req,
    companyId,
  });

  res.status(200).json({
    status: "true",
    data: fundAndBank,
  });
});

exports.updateFundAndBank = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const session = await mongoose.startSession();

  try {
    session.startTransaction();
    const updatedExpenseInvoice = await updateFundAndBankService({
      req,
      companyId,
      session,
    });

    await session.commitTransaction();
    res.status(200).json({
      status: "true",
      message: "Updated Successfully",
      data: updatedExpenseInvoice,
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
});

exports.deleteFundAndBank = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    await deleteFundAndBankService({ req, companyId, session });

    await session.commitTransaction();
    res.status(200).json({
      status: "success",
      message: "Financial fund Deleted",
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
});

exports.getFundAndBankForSalesPoint = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
console.log("companyId", companyId)
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const session = await mongoose.startSession();

  try {
    session.startTransaction();
    const funds = await getFundAndBankForSalesPointService({
      req,
      companyId,
      session,
    });

    await session.commitTransaction();
    res.status(201).json({
      status: "success",
      data: funds,
    });
  }  catch (error) {
  console.error("=== Error in getFundAndBankForSalesPoint ===");
  console.error("Message:", error?.message);
  console.error("Stack:", error?.stack);
  await session.abortTransaction();
  next(error);

  } finally {
    session.endSession();
  }
});

exports.findSpecificFundReports = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const companyId = req.companyId;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const { startDate, endDate, page, limit } = req.query;

  const { reports, totalPages, totalItems, fundBalance } =
    await findSpecificFundReportsService({
      fundId: id,
      companyId,
      startDate,
      endDate,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 0,
    });

  res.status(200).json({
    status: "true",
    totalPages,
    results: reports.length,
    totalItems,
    fundBalance,
    data: reports,
  });
});
