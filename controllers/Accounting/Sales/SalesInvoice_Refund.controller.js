const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const counterModel = require("../../../models/Settings/counterModel");
const {
  findOneSalesRefundService,
  findAllSalesRefundsService,
  prepareRefundSalesInvoiceDataService,
  createRefundSalesInvoiceRecordService,
  applyRefundSalesInventoryEffectsService,
  applyRefundSalesCustomerEffectsService,
  applySalesReturnCartItemEditService,
} = require("../../../services/Accounting/Sales/SalesInvoice_Refund.service");
const {
  createSalesInvoiceRecordService,
} = require("../../../services/Accounting/Sales/SalesInvoice.service");
const orderModel = require("../../../models/orderModel");
const ApiError = require("../../../utils/apiError");

exports.findAllSalesRefunds = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const { totalItems, totalPages, salesRefunds } =
    await findAllSalesRefundsService({
      req,
      companyId,
    });

  res.status(200).json({
    status: "success",
    results: totalItems,
    Pages: totalPages,
    data: salesRefunds,
  });
});

exports.findOneSalesRefund = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const { totalItems, totalPages, salesRefunds, invoiceHistory } =
    await findOneSalesRefundService({
      req,
      companyId,
    });

  res.status(200).json({
    status: "true",
    Pages: totalPages,
    totalItems,
    data: salesRefunds,
    history: invoiceHistory,
  });
});

exports.createRefundSalesInvoice = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  const { invoiceId } = req.body;

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const salesInvoice = await orderModel
      .findOne({ _id: invoiceId, companyId })
      .session(session);
    if (!salesInvoice) {
      return next(new ApiError("Order invoice not found", 404));
    }
    if (salesInvoice.status === "cancelled") {
      return next(
        new ApiError("Cancelled order invoice cannot be updated", 400),
      );
    }
    const padZero = (value) => String(value).padStart(2, "0");
    const padMs = (value) => String(value).padStart(3, "0");

    const now = new Date();
    const updateDate = `${now.getFullYear()}-${padZero(
      now.getMonth() + 1,
    )}-${padZero(now.getDate())}T${padZero(now.getHours())}:${padZero(
      now.getMinutes(),
    )}:${padZero(now.getSeconds())}.${padMs(now.getMilliseconds())}Z`;

    let nextCounterPayment = null;
    let nextCounterRefundSalesInvoices = null;

    nextCounterPayment = await counterModel.findOneAndUpdate(
      { companyId, name: "Payment" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session },
    );

    nextCounterRefundSalesInvoices = await counterModel.findOneAndUpdate(
      { companyId, name: "Refund Sales Invoice" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session },
    );

    const prepared = await prepareRefundSalesInvoiceDataService({
      req,
      companyId,
      session,
    });
    const newRefundSalesInvoice = await createRefundSalesInvoiceRecordService({
      req,
      ...prepared,
      companyId,
      nextCounterPayment,
      nextCounterRefundSalesInvoices,
      session,
      salesInvoice,
    });
    await applySalesReturnCartItemEditService({
      salesInvoice,
      ...prepared,
      session,
    });
    await applyRefundSalesInventoryEffectsService({
      ...prepared,
      newRefundSalesInvoice,
      companyId,
      date: req.body.date,
      session,
    });

    await applyRefundSalesCustomerEffectsService({
      ...prepared,
      newRefundSalesInvoice,
      companyId,
      date: req.body.date,
      totalInMainCurrency: req.body.totalInMainCurrency,
      totalRemainderMainCurrency: req.body.totalRemainderMainCurrency,
      paymentsStatus: req.body.paymentsStatus,
      session,
    });

    await session.commitTransaction();

    res.status(201).json({
      status: "success",
      data: newRefundSalesInvoice,
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    await session.endSession();
  }
});
