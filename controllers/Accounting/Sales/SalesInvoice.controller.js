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
  upsertSalesInvoiceRecordService,
  findAllSalesInvoicesService,
  findOneSalesInvoiceService,
  findCustomerSalesInvoicesService,
} = require("../../../services/Accounting/Sales/SalesInvoice.service");
const mongoose = require("mongoose");
const ApiError = require("../../../utils/apiError");
const orderModel = require("../../../models/orderModel");
const {
  createInvoiceHistory,
} = require("../../../services/invoiceHistoryService");
const { getNextCounterValue } = require("../../../utils/getNextCounterValue");

exports.createSalesInvoice = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  const invoiceDraft = req.body.invoiceDraft;

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    let nextCounterPayment = null;
    let nextCounterSalesInvoices = null;

    if (!invoiceDraft) {
      if (req.body.paymentsStatus !== "unpaid") {
        nextCounterPayment = await counterModel.findOneAndUpdate(
          { companyId, name: "Payment" },
          { $inc: { seq: 1 } },
          { new: true, upsert: true, session },
        );
      }
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
      await applySalesInventoryEffectsService({
        ...prepared,
        newSalesInvoice,
        companyId,
        date: req.body.date,
        session,
        actionType: "create",
      });

      await applySalesCustomerEffectsService({
        ...prepared,
        newSalesInvoice,
        companyId,
        date: req.body.date,
        totalSalesPriceMainCurrency: req.body.totalInMainCurrency,
        totalRemainderMainCurrency: req.body.totalRemainderMainCurrency,
        paymentsStatus: req.body.paymentsStatus,
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

exports.updatePostedSalesInvoice = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  const invoiceId = req.params.id;

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const salesInvoice = await orderModel
      .findOne({ _id: invoiceId, companyId })
      .session(session);

    if (!salesInvoice) {
      return next(new ApiError("Order invoice not found", 404));
    }

    if (salesInvoice.isDraft === true || salesInvoice.status === "draft") {
      return next(
        new ApiError("Draft order invoice should use draft update flow", 400),
      );
    }

    if (salesInvoice.status === "cancelled") {
      return next(
        new ApiError("Cancelled order invoice cannot be updated", 400),
      );
    }

    if (salesInvoice.auditing === true) {
      return next(new ApiError("Audited order invoice cannot be updated", 400));
    }

    if (
      salesInvoice.paymentsStatus === "paid" ||
      (salesInvoice.payments || []).length > 0
    ) {
      return next(
        new ApiError("Paid order invoice cannot be updated in this step", 400),
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

    const oldPrepared = await prepareSalesInvoiceDataFromDraftService({
      salesInvoice,
      companyId,
      session,
    });

    // Make the delete old effect
    await reverseSalesInventoryEffectsService({
      ...oldPrepared,
      salesInvoice,
      companyId,
      session,
      reversedBy: req.user._id,
      reverseReason: "Sales invoice update reversal",
      cancellationDate: updateDate,
      mode: "reverse_update",
    });

    await reverseSalesCustomerEffectsService({
      ...oldPrepared,
      salesInvoice,
      companyId,
      session,
      cancellationDate: updateDate,
      mode: "reverse_update",
    });
    const counterFormat = req.body.counterFormat;
    const reversalJournalLinkCounter = `${
      salesInvoice.journalCounter
    }-reverse-update-${Date.now()}`;

    await reverseSalesJournalEffectsService({
      salesInvoice,
      companyId,
      session,
      cancellationDate: updateDate,
      counterFormat,
      reversalJournalLinkCounter,
      mode: "reverse_update",
    });

    // Make the effect

    const newPrepared = await prepareSalesInvoiceDataService({
      req,
      companyId,
      session,
    });

    let nextCounterPayment = null;

    if (req.body.paymentsStatus === "paid") {
      const paymentSeq = await getNextCounterValue({
        companyId,
        name: "Payment",
        session,
      });

      nextCounterPayment = { seq: paymentSeq };
    }

    const updatedSalesInvoice = await upsertSalesInvoiceRecordService({
      mode: "update",
      req,
      existingInvoice: salesInvoice,
      invoiceDraft: false,
      ...newPrepared,
      companyId,
      nextCounterPayment,
      draftJournalSnapshot: null,
      nextCounterSalesInvoices: null,
      session,
    });

    await applySalesInventoryEffectsService({
      ...newPrepared,
      newSalesInvoice: updatedSalesInvoice,
      companyId,
      date: updatedSalesInvoice.orderDate,
      session,
      actionType: "update",
    });

    await applySalesCustomerEffectsService({
      ...newPrepared,
      newSalesInvoice: updatedSalesInvoice,
      companyId,
      date: updatedSalesInvoice.orderDate,
      totalInMainCurrency: updatedSalesInvoice.totalInMainCurrency,
      totalRemainderMainCurrency:
        updatedSalesInvoice.totalRemainderMainCurrency,
      paymentsStatus: updatedSalesInvoice.paymentsStatus,
      session,
    });

    const journalPreview =
      typeof req.body.journalPreview === "string"
        ? JSON.parse(req.body.journalPreview)
        : req.body.journalPreview;

    if (!journalPreview?.journalMeta) {
      return next(new ApiError("journal preview is required", 400));
    }

    const journalLinkCounter = `sales-${updatedSalesInvoice._id}-${Date.now()}`;

    const { createdJournal } = await debugAndCreateSalesDraftJournalService({
      companyId,
      salesInvoice: updatedSalesInvoice,
      journalPreview,
      counterFormat,
      invoiceRefCounter: updatedSalesInvoice.counter,
      journalLinkCounter,
      session,
    });

    updatedSalesInvoice.journalCounter = journalLinkCounter;

    await updatedSalesInvoice.save({ session });

    await createInvoiceHistory(
      companyId,
      updatedSalesInvoice._id,
      "edit",
      req.user._id,
      updateDate,
      "Sales invoice updated",
      "sales",
      session,
    );

    if (updatedSalesInvoice.paymentsStatus === "paid") {
      await createInvoiceHistory(
        companyId,
        updatedSalesInvoice._id,
        "payment",
        req.user._id,
        req.body.paymentDate || updateDate,
        "Invoice payment recorded from update",
        "sales",
        session,
      );
    }

    await session.commitTransaction();

    res.status(200).json({
      status: "success",
      message: "Sales invoice updated successfully",
      data: updatedSalesInvoice,
      journal: createdJournal,
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
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
      date: salesInvoice.orderDate,
      session,
      actionType: "create",
    });

    await applySalesCustomerEffectsService({
      ...prepared,
      newSalesInvoice: salesInvoice,
      companyId,
      date: salesInvoice.orderDate,
      totalSalesPriceMainCurrency: salesInvoice.totalSalesPriceMainCurrency,
      totalRemainderMainCurrency: salesInvoice.totalRemainderMainCurrency,
      paymentsStatus: salesInvoice.paymentsStatus,
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
    salesInvoice.paymentsStatus = salesInvoice.paymentsStatus || "unpaid";
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
      salesInvoice.paymentsStatus === "paid" ||
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

exports.findAllSalesInvoices = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const { totalItems, totalPages, salesInvoices } =
    await findAllSalesInvoicesService({
      req,
      companyId,
    });

  res.status(200).json({
    status: "true",
    Pages: totalPages,
    results: totalItems,
    data: salesInvoices,
  });
});

exports.findOneSalesInvoice = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const { totalItems, totalPages, salesInvoice, invoiceHistory } =
    await findOneSalesInvoiceService({
      req,
      companyId,
    });

  res.status(200).json({
    status: "true",
    Pages: totalPages,
    data: salesInvoice,
    history: invoiceHistory,
  });
});

exports.findCustomerSalesInvoices = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const { totalItems, totalPages, salesInvoices, invoiceHistory } =
    await findCustomerSalesInvoicesService({
      req,
      companyId,
    });

  res.status(200).json({
    status: "true",
    Pages: totalPages,
    data: salesInvoices,
    history: invoiceHistory,
  });
});
