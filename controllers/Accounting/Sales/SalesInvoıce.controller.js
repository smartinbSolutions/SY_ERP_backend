const asyncHandler = require("express-async-handler");
const counterModel = require("../../../models/Settings/counterModel");
const {
  prepareSalesInvoiceDataService,
  createSalesInvoiceRecordService,
  prepareSalesInvoiceDataFromDraftService,
  applySalesInventoryEffectsService,
  applySalesCustomerEffectsService,
  debugAndCreateSalesDraftJournalService,
} = require("../../../services/Accounting/Sales/SalesInvoice.service");
const mongoose = require("mongoose");
const ApiError = require("../../../utils/apiError");
const orderModel = require("../../../models/orderModel");

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

    console.log(req.user);

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
