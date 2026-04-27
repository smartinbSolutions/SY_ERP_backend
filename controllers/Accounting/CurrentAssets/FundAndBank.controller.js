const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const {
  findAllFundAndBankService,
  findOneFundAndBankService,
  createFundAndBankService,
  deleteFundAndBankService,
  updateFundAndBankService,
  getFundAndBankForSalesPointService,
} = require("../../../services/Accounting/CurrentAssets/Funds/FundAndBanck.service");

exports.findAllFundAndBank = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

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
  const companyId = req.query.companyId;
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    req.body.companyId = companyId;
    const newFundAndBank = await createFundAndBankService({ req, companyId });

    await session.commitTransaction();
    res.status(201).json({
      status: "success",
      data: newFundAndBank,
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
});

exports.findOneFundAndBank = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

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
  const companyId = req.query.companyId;

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
  const companyId = req.query.companyId;
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    await deleteFundAndBankService({ req, companyId });

    await session.commitTransaction();
    res.status(201).json({
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
  const companyId = req.query.companyId;

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
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
});
