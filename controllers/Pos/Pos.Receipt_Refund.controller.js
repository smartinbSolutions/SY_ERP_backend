const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const counterModel = require("../../models/Settings/counterModel");
const ApiError = require("../../utils/apiError");
const {
  findAllPosReceiptsRefundService,
  findOnePosReceiptRefundService,
  createPosReceiptRefundService,
  applyReciptRefundFundEffectService,
  applyReciptRefundInventoryEffectService,
  findRefundReceiptForDateService,
} = require("../../services/Pos/Pos.Receipt_refund.service");
const { buildTurkeyDate } = require("../../services/Pos/Pos.Receipt.service");
const posReceiptModel = require("../../models/Pos/pos.receipt.model");

exports.findAllPosReceiptRefund = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  console.log("Iam here");
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const { totalItems, totalPages, refund, stats } =
    await findAllPosReceiptsRefundService({
      req,
      companyId,
    });

  res.status(200).json({
    status: "success",
    results: totalItems,
    Pages: totalPages,
    data: refund,
    stats,
  });
});

exports.findOnePosReceiptRefund = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const receiptRefund = await findOnePosReceiptRefundService({
    req,
    companyId,
  });

  res.status(200).json({
    status: "success",
    data: receiptRefund,
  });
});

exports.createPosReceiptRefund = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    req.body.companyId = companyId;

    const nextCounterRecipt = await counterModel.findOneAndUpdate(
      { companyId, name: "Pos Receipt Refund" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session }
    );
    const dateTurkey = await buildTurkeyDate();

    const receipt = await posReceiptModel
      .findOne({ _id: req.body.orderId, companyId })
      .session(session);

    if (!receipt) {
      throw new ApiError("Original POS receipt not found", 404);
    }

    if (receipt.type === "cancel") {
      throw new ApiError("Cannot refund a cancelled POS receipt", 400);
    }

    const isFullyRefunded =
      receipt.isRefund === true ||
      receipt.returnCartItem?.every(
        (item) => Number(item.soldQuantity || 0) <= 0
      );

    if (isFullyRefunded) {
      throw new ApiError("POS receipt is already refunded", 400);
    }

    req.body.employee = req.user?.name || req.body.employee;
    req.body.salesPoint = receipt.salesPoint;
    req.body.stock = receipt.stock;
    req.body.receipt = receipt._id;
    req.body.receiptCounter = receipt.counter;

    const newReceipt = await createPosReceiptRefundService({
      req,
      session,
      nextCounterRecipt,
      companyId,
      dateTurkey,
      receipt,
    });

    await applyReciptRefundFundEffectService({
      req,
      session,
      companyId,
      newReceipt,
      dateTurkey,
    });

    await applyReciptRefundInventoryEffectService({
      req,
      session,
      companyId,
      newReceipt,
      dateTurkey,
      receipt,
    });

    // ── Update original receipt status ─────────────────────────────────────
    const updatedReturnItems = receipt.returnCartItem.map((originalItem) => {
      const originalId = String(originalItem.id || originalItem._id);
      const refundedItem = req.body.cartItems.find(
        (i) => String(i.id || i._id) === originalId
      );
      if (!refundedItem) return originalItem;
      return {
        ...originalItem.toObject(),
        soldQuantity:
          Number(originalItem.soldQuantity || 0) -
          Number(refundedItem.soldQuantity || 0),
      };
    });

    const allFullyRefunded = updatedReturnItems.every(
      (item) => Number(item.soldQuantity || 0) <= 0
    );

    await posReceiptModel.findOneAndUpdate(
      { _id: receipt._id },
      {
        $set: {
          returnCartItem: updatedReturnItems,
          status: allFullyRefunded ? "fully_refunded" : "partially_refunded",
        },
      },
      { session, new: true }
    );

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

exports.findRefundReceiptForDate = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const receipt = await findRefundReceiptForDateService({
    req,
    companyId,
  });

  res.status(200).json({
    status: "true",
    data: receipt,
  });
});
