const asyncHandler = require("express-async-handler");
const ApiError = require("../../../utils/apiError");
const mongoose = require("mongoose");

const {
  purchaseInvoiceDraftService,
} = require("../../../services/purchaseInvoicesServices");
const {
  preparePurchaseInvoiceDataService,
  createPurchaseInvoiceRecordService,
  applyPurchaseInventoryEffectsService,
  applyPurchaseSupplierEffectsService,
  deletePurchaseInvoiceDraftService,
  updatePurchaseInvoiceDraftService,
  preparePurchaseInvoiceDataFromDraftService,
  debugAndCreatePurchaseDraftJournalService,
  reversePurchaseSupplierEffectsService,
  reversePurchaseInventoryEffectsService,
  reversePurchaseJournalEffectsService,
} = require("../../../services/Accounting/Purchase/PurchaseInvoice.service");

const counterModel = require("../../../models/Settings/counterModel");
const purchaseinvoicesModel = require("../../../models/purchaseinvoicesModel");
const {
  createInvoiceHistory,
} = require("../../../services/invoiceHistoryService");

/*
|--------------------------------------------------------------------------
| Create Purchase Invoice 
|--------------------------------------------------------------------------
*/
exports.createPurchaseInvoice = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  const invoiceDraft = req.body.isDraft === "true";

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    let nextCounterPayment = null;
    let nextCounterPurchaseInvoices = null;

    if (!invoiceDraft) {
      nextCounterPayment = await counterModel.findOneAndUpdate(
        { companyId, name: "Payment" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, session }
      );

      nextCounterPurchaseInvoices = await counterModel.findOneAndUpdate(
        { companyId, name: "Purchase Invoice" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, session }
      );
    }

    const prepared = await preparePurchaseInvoiceDataService({
      req,
      companyId,
      session,
    });

    const newPurchaseInvoice = await createPurchaseInvoiceRecordService({
      req,
      invoiceDraft,
      ...prepared,
      companyId,
      nextCounterPayment,
      nextCounterPurchaseInvoices,
      session,
    });

    if (!invoiceDraft) {
      await applyPurchaseInventoryEffectsService({
        ...prepared,
        newPurchaseInvoice,
        companyId,
        date: req.body.date,
        session,
      });

      await applyPurchaseSupplierEffectsService({
        ...prepared,
        newPurchaseInvoice,
        companyId,
        date: req.body.date,
        totalPurchasePriceMainCurrency: req.body.totalInMainCurrency,
        totalRemainderMainCurrency: req.body.totalRemainderMainCurrency,
        paid: req.body.paid,
        session,
      });
    }

    await session.commitTransaction();

    res.status(201).json({
      status: "success",
      data: newPurchaseInvoice,
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
});
/*
|--------------------------------------------------------------------------
| Post Draft Invoice 
|--------------------------------------------------------------------------
*/
exports.postPurchaseInvoiceDraft = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  const invoiceId = req.params.id;

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const purchaseInvoice = await purchaseinvoicesModel
      .findOne({ _id: invoiceId, companyId })
      .session(session);

    if (!purchaseInvoice) {
      return next(new ApiError("Purchase invoice draft not found", 404));
    }

    if (
      purchaseInvoice.isDraft !== true ||
      purchaseInvoice.status !== "draft"
    ) {
      return next(new ApiError("This invoice is Not Draft to post", 400));
    }

    const journalPreview =
      typeof req.body.journalPreview === "string"
        ? JSON.parse(req.body.journalPreview)
        : req.body.journalPreview;

    if (!journalPreview?.journalMeta) {
      return next(new ApiError("journal preview is required", 400));
    }

    const nextCounterPurchaseInvoices = await counterModel.findOneAndUpdate(
      { companyId, name: "Purchase Invoice" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session }
    );

    const baseCounter = Number(req.body.counter || 0);
    const finalPurchaseCounter = baseCounter + nextCounterPurchaseInvoices.seq;
    const journalLink = Date.now().toString();

    purchaseInvoice.counter = finalPurchaseCounter;
    purchaseInvoice.journalCounter = journalLink;

    const prepared = await preparePurchaseInvoiceDataFromDraftService({
      purchaseInvoice,
      companyId,
      session,
    });

    await applyPurchaseInventoryEffectsService({
      ...prepared,
      newPurchaseInvoice: purchaseInvoice,
      companyId,
      date: purchaseInvoice.date,
      session,
    });

    await applyPurchaseSupplierEffectsService({
      ...prepared,
      newPurchaseInvoice: purchaseInvoice,
      companyId,
      date: purchaseInvoice.date,
      totalPurchasePriceMainCurrency:
        purchaseInvoice.totalPurchasePriceMainCurrency,
      totalRemainderMainCurrency: purchaseInvoice.totalRemainderMainCurrency,
      paid: purchaseInvoice.paid,
      session,
    });

    const { createdJournal } = await debugAndCreatePurchaseDraftJournalService({
      companyId,
      purchaseInvoice,
      journalPreview,
      refCounter: finalPurchaseCounter,
      journalLink,
      session,
    });

    purchaseInvoice.status = "posted";
    purchaseInvoice.isDraft = false;
    purchaseInvoice.postedBy = req.user._id;
    purchaseInvoice.postedAt = new Date();
    purchaseInvoice.paid = purchaseInvoice.paid || "unpaid";
    purchaseInvoice.journalCounter = journalLink;

    await purchaseInvoice.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      status: "success",
      message: "Purchase invoice draft posted successfully",
      data: purchaseInvoice,
      journal: createdJournal,
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
});
/*
|--------------------------------------------------------------------------
| Update Draft
|--------------------------------------------------------------------------
*/

exports.updatePurchaseInvoice = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }
  console.log("triggerd");
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const invoiceDraft = req.body.isDraft === "true";

    let invoice;

    if (invoiceDraft) {
      invoice = await updatePurchaseInvoiceDraftService({
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

exports.cancelPurchaseInvoice = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  const invoiceId = req.params.id;

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const purchaseInvoice = await purchaseinvoicesModel
      .findOne({ _id: invoiceId, companyId })
      .session(session);

    if (!purchaseInvoice) {
      return next(new ApiError("Purchase invoice not found", 404));
    }

    if (
      purchaseInvoice.isDraft === true ||
      purchaseInvoice.status === "draft"
    ) {
      return next(new ApiError("Draft invoice cannot be cancelled", 400));
    }

    if (purchaseInvoice.status === "cancelled") {
      return next(new ApiError("Purchase invoice is already cancelled", 400));
    }

    if (purchaseInvoice.auditing === true) {
      return next(
        new ApiError("Audited purchase invoice cannot be cancelled", 400)
      );
    }

    if (
      purchaseInvoice.paid === "paid" ||
      (purchaseInvoice.payments || []).length > 0
    ) {
      return next(
        new ApiError(
          "Paid purchase invoice cannot be cancelled in this step",
          400
        )
      );
    }

    const padZero = (value) => String(value).padStart(2, "0");
    const padMs = (value) => String(value).padStart(3, "0");

    const now = new Date();
    const cancellationDate = `${now.getFullYear()}-${padZero(
      now.getMonth() + 1
    )}-${padZero(now.getDate())}T${padZero(now.getHours())}:${padZero(
      now.getMinutes()
    )}:${padZero(now.getSeconds())}.${padMs(now.getMilliseconds())}Z`;

    const prepared = await preparePurchaseInvoiceDataFromDraftService({
      purchaseInvoice,
      companyId,
      session,
    });

    await reversePurchaseInventoryEffectsService({
      ...prepared,
      purchaseInvoice,
      companyId,
      session,
      reversedBy: req.user._id,
      reverseReason: req.body.reason || "Purchase invoice cancellation",
      cancellationDate,
    });

    await reversePurchaseSupplierEffectsService({
      ...prepared,
      purchaseInvoice,
      companyId,
      session,
      cancellationDate,
    });

    await reversePurchaseJournalEffectsService({
      purchaseInvoice,
      companyId,
      session,
      cancellationDate,
    });

    purchaseInvoice.status = "cancelled";
    purchaseInvoice.type = "purchase cancelled";
    purchaseInvoice.cancelledAt = cancellationDate;
    purchaseInvoice.cancelledBy = req.user._id;
    purchaseInvoice.cancellationReason = req.body.reason || "";

    await purchaseInvoice.save({ session });

    await createInvoiceHistory(
      companyId,
      purchaseInvoice._id,
      "cancel",
      req.user._id,
      cancellationDate,
      "Purchase invoice cancelled",
      "purchase",
      session
    );

    await session.commitTransaction();

    res.status(200).json({
      status: "success",
      message: "Purchase invoice cancelled successfully",
      data: purchaseInvoice,
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
});

/*
|--------------------------------------------------------------------------
| Delete Draft
|--------------------------------------------------------------------------
*/
exports.deletePurchaseInvoiceDraft = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  const invoiceId = req.params.id;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await deletePurchaseInvoiceDraftService({
      invoiceId,
      companyId,
      userId: req.user._id,
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

/*
|--------------------------------------------------------------------------
| Approve Draft
|--------------------------------------------------------------------------
*/
exports.approvePurchaseInvoiceDraft = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  const { id } = req.params;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  const invoice = await purchaseInvoiceDraftService.approveDraft({
    id,
    companyId,
    user: req.user,
  });

  res.status(200).json({
    status: "success",
    message: "Draft approved successfully",
    data: invoice,
  });
});

/*
|--------------------------------------------------------------------------
| Get Drafts
|--------------------------------------------------------------------------
*/
exports.getPurchaseInvoiceDrafts = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  const drafts = await purchaseInvoiceDraftService.getDrafts({
    companyId,
  });

  res.status(200).json({
    status: "success",
    results: drafts.length,
    data: drafts,
  });
});

/*
|--------------------------------------------------------------------------
| Get Single Draft
|--------------------------------------------------------------------------
*/
exports.getSinglePurchaseInvoiceDraft = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  const { id } = req.params;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  const draft = await purchaseInvoiceDraftService.getDraftById({
    id,
    companyId,
  });

  res.status(200).json({
    status: "success",
    data: draft,
  });
});
