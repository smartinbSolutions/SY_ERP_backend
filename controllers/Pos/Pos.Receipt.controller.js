const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const mongoose = require("mongoose");
const counterModel = require("../../models/Settings/counterModel");
const receiptService = require("../../services/Pos/Pos.Receipt.service");
const receiptModel = require("../../models/Pos/pos.receipt.model");
const companyInfoModel = require("../../models/Settings/CompanyInfo/companyInfo.model");

exports.createPosReceipt = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    if (!companyId) {
      return res.status(400).json({ message: "companyId is required" });
    }
    req.body.employee = req.user.name;
    req.body.companyId = req.companyId;

    const nextCounterRecipt = await counterModel.findOneAndUpdate(
      { companyId, name: "Pos Receipt" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session }
    );

    const dateTurkey = await receiptService.buildTurkeyDate();
    const newReceipt = await receiptService.createPosReceiptService({
      req,
      session,
      nextCounterRecipt,
      companyId,
      dateTurkey,
    });

    await receiptService.applyFundEffectService({
      req,
      session,
      companyId,
      newReceipt,
      dateTurkey,
    });

    await receiptService.applyReciptInventoryEffectService({
      req,
      session,
      companyId,
      newReceipt,
      dateTurkey,
    });
    await session.commitTransaction();

    res.status(201).json({
      status: "success",
      data: newReceipt,
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
});

exports.findAllReceipt = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const { totalItems, totalPages, receipt } =
    await receiptService.findAllReceiptService({
      req,
      companyId,
    });

  res.status(200).json({
    status: "true",
    Pages: totalPages,
    results: totalItems,
    data: receipt,
  });
});

exports.findOneReceipt = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const { receipt } = await receiptService.findOneReceiptService({
    req,
    companyId,
  });

  res.status(200).json({
    status: "true",
    data: receipt,
  });
});

exports.cancelReceipt = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const receiptId = req.params.id;
  const { stockId } = req.body;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const receipt = await receiptModel
      .findOne({ _id: receiptId, companyId })
      .session(session);

    if (!receipt) {
      return next(new ApiError("Receipt not found", 404));
    }

    if (receipt.status === "cancelled" || receipt.status === "fully_refunded") {
      return next(
        new ApiError("Receipt is already cancelled or refunded", 400)
      );
    }

    const dateTurkey = await receiptService.buildTurkeyDate();
    const cancellationStockId = stockId || receipt.stock;

    await receiptService.reverseReceiptInventoryEffectsService({
      receipt,
      companyId,
      session,
      reversedBy: req.user.id,
      cancellationDate: dateTurkey,
      stockId: cancellationStockId,
      dateTurkey,
    });

    await receiptService.reverseReceiptFundEffectsService({
      receipt,
      companyId,
      session,
      dateTurkey,
      createdBy: req.user.id,
    });

    receipt.status = "cancelled";
    await receipt.save({ session });

    await session.commitTransaction();

    res.status(201).json({ status: "success" });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
});

exports.findReceiptForDate = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const receipt = await receiptService.findReceiptForDateService({
    req,
    companyId,
  });

  res.status(200).json({
    status: "true",
    data: receipt,
  });
});

exports.findAllReceiptForSalesPoint = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const { totalItems, totalPages, receipt } =
    await receiptService.findAllReceiptForSalesPointService({
      req,
      companyId,
    });

  res.status(200).json({
    status: "true",
    Pages: totalPages,
    results: totalItems,
    data: receipt,
  });
});

exports.mergeReceipts = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    if (!companyId) {
      return res.status(400).json({ message: "companyId is required" });
    }
    req.body.employee = req.user.name;
    req.body.companyId = req.companyId;

    const nextCounterJournal = await counterModel.findOneAndUpdate(
      { companyId, name: "Journal" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session }
    );
    const nextCounterSalesInvoices = await counterModel.findOneAndUpdate(
      { companyId, name: "Sales Invoice" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session }
    );
    const company = await companyInfoModel.findById(companyId);

    const merge = await receiptService.mergeReceiptsService({
      req,
      companyId,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      id: req.body.id,
      session,
      company,
    });

    const newSales = await receiptService.mergeEffectService({
      receipts: merge.receipts,
      date: merge.date,
      counter: merge.counter,
      salesPoints: merge.salesPoints,
      session,
      company,
    });
    await session.commitTransaction();

    res.status(201).json({
      status: "success",
      data: newSales,
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
});
