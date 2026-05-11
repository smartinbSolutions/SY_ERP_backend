const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const {
  processPaymentService,
  getOnePaymentService,
  getAllPaymentsService,
  cancelPaymentService,
} = require("../../../services/Accounting/CurrentAssets/Payments/Payment.service");

exports.createPayment = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const result = await processPaymentService({
    req,
    companyId,
    next,
  });

  return res.status(201).json(result);
});

exports.getOnePayment = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  const paymentId = req.params.id;

  const payment = await getOnePaymentService({
    paymentId,
    companyId,
  });

  res.status(200).json({
    status: "success",
    data: payment,
  });
});

exports.getAllPayments = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId)
    return res.status(400).json({ message: "companyId is required" });

  const result = await getAllPaymentsService({
    companyId,
    paymentNature: req.query.paymentNature,
    paymentContext: req.query.paymentContext,
    page: req.query.page,
    limit: req.query.limit,
    dateFrom: req.query.dateFrom,
    dateTo: req.query.dateTo,
    partyId: req.query.partyId,
  });

  res.status(200).json({ status: "success", ...result });
});

// ─────────────────────────────────────────────────────────────────
// cancelPayment controller
// ─────────────────────────────────────────────────────────────────
exports.cancelPayment = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  const paymentId = req.params.id;

  if (!companyId)
    return res.status(400).json({ message: "companyId is required" });
  if (!paymentId)
    return res.status(400).json({ message: "paymentId is required" });

  const session = await mongoose.startSession();
  console.log(req.body);
  try {
    session.startTransaction();

    const cancelledPayment = await cancelPaymentService({
      paymentId,
      companyId,
      userId: req.user._id,
      reason: req.body.reason || "",
      session,
    });

    await session.commitTransaction();

    res.status(200).json({
      status: "success",
      message: "Payment cancelled successfully",
      data: cancelledPayment,
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
});
