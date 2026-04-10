const asyncHandler = require("express-async-handler");
const counterModel = require("../../../models/Settings/counterModel");
const {
  prepareSalesInvoiceDataService,
  createSalesInvoiceRecordService,
  prepareSalesInvoiceDataFromDraftService,
  applySalesInventoryEffectsService,
  applySalesCustomerEffectsService,
  debugAndCreateSalesDraftJournalService,
  deleteSalesInvoiceDraftService,
  updateSalesInvoiceDraftService,
  reverseSalesInventoryEffectsService,
  reverseSalesCustomerEffectsService,
  reverseSalesJournalEffectsService,
} = require("../../../services/Accounting/Sales/SalesInvoice.service");
const mongoose = require("mongoose");
const ApiError = require("../../../utils/apiError");
const orderModel = require("../../../models/orderModel");
const {
  createInvoiceHistory,
} = require("../../../services/invoiceHistoryService");

exports.createSalesInvoice = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  const invoiceDraft = req.body.invoiceDraft;

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    let nextCounterPayment = null;
    let nextCounterSalesInvoices = null;

    if (!invoiceDraft) {
      nextCounterPayment = await counterModel.findOneAndUpdate(
        { companyId, name: "Payment" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, session },
      );

      nextCounterSalesInvoices = await counterModel.findOneAndUpdate(
        { companyId, name: "Sales Invoice" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, session },
      );
    }

    const prepared = await prepareSalesInvoiceDataService({
      req,
      companyId,
      session,
    });

    const newSalesInvoice = await createSalesInvoiceRecordService({
      req,
      invoiceDraft,
      ...prepared,
      companyId,
      nextCounterPayment,
      nextCounterSalesInvoices,
      session,
    });

    if (!invoiceDraft) {
      await applySalesCustomerEffectsService({
        ...prepared,
        newSalesInvoice,
        companyId,
        date: req.body.date,
        session,
      });

      await applySalesInventoryEffectsService({
        ...prepared,
        newSalesInvoice,
        companyId,
        date: req.body.date,
        totalInMainCurrency: req.body.totalInMainCurrency,
        totalRemainderMainCurrency: req.body.totalRemainderMainCurrency,
        paid: req.body.paid,
        session,
      });
    }

    await session.commitTransaction();

    res.status(201).json({
      status: "success",
      data: newSalesInvoice,
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    await session.endSession();
  }
});

//convert to posted sales invoice from draft sales invoice
exports.postSalesInvoiceDraft = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  const invoiceId = req.params.id;

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const salesInvoice = await orderModel
      .findOne({ _id: invoiceId, companyId })
      .session(session);

    if (!salesInvoice) {
      return next(new ApiError("sales invoice draft not found", 404));
    }

    if (salesInvoice.isDraft !== true || salesInvoice.status !== "draft") {
      return next(new ApiError("This invoice is Not Draft to post", 400));
    }

    const journalPreview =
      typeof req.body.journalPreview === "string"
        ? JSON.parse(req.body.journalPreview)
        : req.body.journalPreview;

    if (!journalPreview?.journalMeta) {
      return next(new ApiError("journal preview is required", 400));
    }

    const nextCounterSalesInvoices = await counterModel.findOneAndUpdate(
      { companyId, name: "Sales Invoice" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session },
    );

    const baseCounter = Number(req.body.counter || 0);
    const finalSalesCounter = baseCounter + nextCounterSalesInvoices.seq;
    const journalLink = Date.now().toString();

    salesInvoice.counter = finalSalesCounter;
    salesInvoice.journalCounter = journalLink;

    const prepared = await prepareSalesInvoiceDataFromDraftService({
      salesInvoice,
      companyId,
      session,
    });

    await applySalesInventoryEffectsService({
      ...prepared,
      newSalesInvoice: salesInvoice,
      companyId,
      date: salesInvoice.date,
      session,
    });

    await applySalesCustomerEffectsService({
      ...prepared,
      newSalesInvoice: salesInvoice,
      companyId,
      date: salesInvoice.date,
      totalSalesPriceMainCurrency: salesInvoice.totalSalesPriceMainCurrency,
      totalRemainderMainCurrency: salesInvoice.totalRemainderMainCurrency,
      paid: salesInvoice.paid,
      session,
    });

    const { createdJournal } = await debugAndCreateSalesDraftJournalService({
      companyId,
      salesInvoice,
      journalPreview,
      counterFormat: baseCounter,
      invoiceRefCounter: finalSalesCounter,
      journalLinkCounter: journalLink,
      session,
    });
    salesInvoice.status = "posted";
    salesInvoice.isDraft = false;
    salesInvoice.postedBy = req.user?._id;
    salesInvoice.postedAt = new Date();
    salesInvoice.paid = salesInvoice.paid || "unpaid";
    salesInvoice.journalCounter = journalLink;

    await salesInvoice.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      status: "success",
      message: "Sales invoice draft posted successfully",
      data: salesInvoice,
      journal: createdJournal,
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
});

exports.updateSalesDraftInvoice = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const invoiceDraft = req.body.isDraft;

    let invoice;

    if (invoiceDraft) {
      invoice = await updateSalesInvoiceDraftService({
        req,
        companyId,
        session,
      });
    } else {
      console.log("not resolved yet");
    }

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      status: "success",
      message: "Draft invoice updated successfully",
      data: invoice,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
});

exports.deleteSalesInvoiceDraft = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  const invoiceId = req.params.id;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await deleteSalesInvoiceDraftService({
      invoiceId,
      companyId,
      session,
    });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      status: "success",
      message: "Draft invoice deleted successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
});

exports.cancelSalesInvoice = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  const invoiceId = req.params.id;

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const salesInvoice = await orderModel
      .findOne({ _id: invoiceId, companyId })
      .session(session);

    if (!salesInvoice) {
      return next(new ApiError("Sales invoice not found", 404));
    }

    if (salesInvoice.isDraft === true || salesInvoice.status === "draft") {
      return next(new ApiError("Draft invoice cannot be cancelled", 400));
    }

    if (salesInvoice.status === "cancelled") {
      return next(new ApiError("Sales invoice is already cancelled", 400));
    }

    if (salesInvoice.auditing === true) {
      return next(
        new ApiError("Audited sales invoice cannot be cancelled", 400),
      );
    }

    if (
      salesInvoice.paid === "paid" ||
      (salesInvoice.payments || []).length > 0
    ) {
      return next(
        new ApiError(
          "Paid sales invoice cannot be cancelled in this step",
          400,
        ),
      );
    }
    const baseCounter = Number(req.body.counter || 0);
    const padZero = (value) => String(value).padStart(2, "0");
    const padMs = (value) => String(value).padStart(3, "0");

    const now = new Date();
    const cancellationDate = `${now.getFullYear()}-${padZero(
      now.getMonth() + 1,
    )}-${padZero(now.getDate())}T${padZero(now.getHours())}:${padZero(
      now.getMinutes(),
    )}:${padZero(now.getSeconds())}.${padMs(now.getMilliseconds())}Z`;

    const prepared = await prepareSalesInvoiceDataFromDraftService({
      salesInvoice,
      companyId,
      session,
    });

    await reverseSalesInventoryEffectsService({
      ...prepared,
      salesInvoice,
      companyId,
      session,
      reversedBy: req.user._id,
      reverseReason: req.body.reason || "Sales invoice cancellation",
      cancellationDate,
    });

    await reverseSalesCustomerEffectsService({
      ...prepared,
      salesInvoice,
      companyId,
      session,
      cancellationDate,
    });

    await reverseSalesJournalEffectsService({
      companyId,
      salesInvoice,
      session,
      counterFormat: baseCounter,
      cancellationDate,
    });

    salesInvoice.status = "cancelled";
    salesInvoice.type = "sales cancelled";
    salesInvoice.cancelledAt = cancellationDate;
    salesInvoice.cancelledBy = req.user._id;
    salesInvoice.cancellationReason = req.body.reason || "";

    await salesInvoice.save({ session });

    await createInvoiceHistory(
      companyId,
      salesInvoice._id,
      "cancel",
      req.user._id,
      cancellationDate,
      "Sales invoice cancelled",
      "sales",
      session,
    );

    await session.commitTransaction();

    res.status(200).json({
      status: "success",
      message: "Sales invoice cancelled successfully",
      data: salesInvoice,
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
});
