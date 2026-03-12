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
} = require("../../../services/Accounting/Purchase/PurchaseInvoice.service");

const counterModel = require("../../../models/Settings/counterModel");
const purchaseinvoicesModel = require("../../../models/purchaseinvoicesModel");

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

    const nextCounterPayment = await counterModel.findOneAndUpdate(
      { companyId, name: "Payment" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session }
    );

    const nextCounterPurchaseInvoices = await counterModel.findOneAndUpdate(
      { companyId, name: "Purchase Invoice" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session }
    );

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

    // Apply effects only if not draft
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
      .findOne({
        _id: invoiceId,
        companyId,
      })
      .session(session);

    if (!purchaseInvoice) {
      return next(new ApiError("Purchase invoice draft not found", 404));
    }

    if (purchaseInvoice.isDraft !== true) {
      return next(new ApiError("This invoice is already posted", 400));
    }

    const journalPreview =
      typeof req.body.journalPreview === "string"
        ? JSON.parse(req.body.journalPreview)
        : req.body.journalPreview;

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
      session,
    });

    purchaseInvoice.isDraft = false;
    purchaseInvoice.postedAt = new Date();
    purchaseInvoice.paid = purchaseInvoice.paid || "unpaid";
    purchaseInvoice.draftJournalSnapshot = purchaseInvoice.draftJournalSnapshot;
    purchaseInvoice.journalCounter =
      createdJournal?.counter || purchaseInvoice?.journalCounter;

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
