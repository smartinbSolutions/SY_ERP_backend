const asyncHandler = require("express-async-handler");
const ApiError = require("../../../utils/apiError");
const mongoose = require("mongoose");

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
  upsertPurchaseInvoiceRecordService,
  findAllPurchaseInvoicesService,
  findOnePurchaseInvoiceService,
  findSupplierPurchaseInvoicesForRefundService,
} = require("../../../services/Accounting/Purchase/PurchaseInvoice.service");

const counterModel = require("../../../models/Settings/counterModel");
const purchaseinvoicesModel = require("../../../models/purchaseinvoicesModel");
const {
  createInvoiceHistory,
} = require("../../../services/invoiceHistoryService");
const { getNextCounterValue } = require("../../../utils/getNextCounterValue");
const {
  handlePurchasePayment,
} = require("../../../services/Accounting/CurrentAssets/Payments/Payment.handlers");
const {
  prepareSalesInvoiceDataFromDraftService,
} = require("../../../services/Accounting/Sales/SalesInvoice.service");
const {
  createJournalEntryService,
} = require("../../../services/Accounting/JournalEntries/journalEntries.Service");
const linkPanelModel = require("../../../models/linkPanelModel");

/*
|--------------------------------------------------------------------------
| Get Purchase Invoice 
|--------------------------------------------------------------------------
*/

exports.findAllPurchaseInvoices = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const { totalItems, totalPages, purchaseInvoices } =
    await findAllPurchaseInvoicesService({
      req,
      companyId,
    });

  res.status(200).json({
    status: "true",
    Pages: totalPages,
    results: purchaseInvoices.length,
    data: purchaseInvoices,
  });
});

exports.findOnePurchaseInvoice = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const { totalItems, totalPages, purchaseInvoice, invoiceHistory } =
    await findOnePurchaseInvoiceService({
      req,
      companyId,
    });

  res.status(200).json({
    status: "true",
    Pages: totalPages,
    data: purchaseInvoice,
    history: invoiceHistory,
  });
});

exports.findSupplierPurchaseInvoicesForRefund = asyncHandler(
  async (req, res, next) => {
    const companyId = req.query.companyId;

    if (!companyId) {
      return res.status(400).json({ message: "companyId is required" });
    }

    const { totalItems, totalPages, purchaseInvoices } =
      await findSupplierPurchaseInvoicesForRefundService({
        req,
        companyId,
      });

    res.status(200).json({
      status: "true",
      Pages: totalPages,
      results: purchaseInvoices.length,
      totalItems,
      data: purchaseInvoices,
    });
  }
);

exports.createPurchaseInvoice = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  const invoiceDraft = req.body.isDraft === "true";

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    let nextCounterPayment = null;
    let nextCounterPurchaseInvoices = null;
    let nextCounterJournal = null;

    if (!invoiceDraft) {
      if (req.body.paid !== "unpaid") {
        nextCounterPayment = await counterModel.findOneAndUpdate(
          { companyId, name: "Payment" },
          { $inc: { seq: 1 } },
          { new: true, upsert: true, session }
        );
      }

      nextCounterPurchaseInvoices = await counterModel.findOneAndUpdate(
        { companyId, name: "Purchase Invoice" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, session }
      );

      nextCounterJournal = await counterModel.findOneAndUpdate(
        { companyId, name: "Journal" },
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
      // ── Inventory effects ──────────────────────────────────────
      await applyPurchaseInventoryEffectsService({
        ...prepared,
        newPurchaseInvoice,
        companyId,
        date: req.body.date,
        session,
      });

      // ── Supplier effects ───────────────────────────────────────
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

      // ── Parse journalPreview FIRST ─────────────────────────────
      const journalPreview = req.body.journalPreview
        ? JSON.parse(req.body.journalPreview)
        : null;

      // ── Payment ────────────────────────────────────────────────
      let fxDiff = 0; // ← declare outside so it's accessible below

      if (req.body.havepayments === "paid") {
        const fund = req.body.fund ? JSON.parse(req.body.fund) : null;
        const payment = req.body.payment ? JSON.parse(req.body.payment) : null;

        const normalizedPayment = {
          party: {
            id: prepared.supplier?._id?.toString() || "",
            name: prepared.supplier?.supplierName || "",
            type: "supplier",
          },
          fund: {
            id: fund?.id || fund?._id || "",
            name: fund?.name || "",
            currencyId: fund?.currencyId || "",
            currencyCode: fund?.currencyCode || "",
            exchangeRate: Number(fund?.exchangeRate || 1),
          },
          paymentNature: "outgoing",
          payment: {
            amount: Number(payment?.amount || 0),
            currencyId: payment?.currencyId || "",
            currencyCode: payment?.currencyCode || "",
            exchangeRate: Number(payment?.exchangeRate || 1),
            amountMainCurrency: Number(payment?.amountMainCurrency || 0),
            amountInvoiceCurrency: Number(payment?.amountInvoiceCurrency || 0),
          },
          invoiceId: newPurchaseInvoice._id,
          date: req.body.paymentDate || req.body.date,
          description: req.body.description || "",
          journalCounter: req.body.journalCounter || "",
          counter: req.body.counter || "0",
          companyId,
          postedBy: req.user?._id || null,
          postedAt: new Date(),
          journalAccounts: null,
        };

        const result = await handlePurchasePayment(
          req,
          companyId,
          next,
          normalizedPayment,
          session
        );

        fxDiff = result.fxDiff || 0; // ← capture fxDiff
      }

      // ── Append FX lines to journalPreview if needed ───────────
      if (
        req.body.havepayments === "paid" &&
        journalPreview &&
        Math.abs(fxDiff) > 0.001
      ) {
        const linkings = await linkPanelModel
          .find({ companyId })
          .populate("accountData")
          .session(session);

        const fxGainLink = linkings.find(
          (l) => l.name === "Foreign Exchange Gain"
        );
        const fxLossLink = linkings.find(
          (l) => l.name === "Foreign Exchange Loss"
        );

        const isLoss = fxDiff > 0;
        const fxAccount = isLoss
          ? fxLossLink?.accountData
          : fxGainLink?.accountData;
        const partyJournalAccount = journalPreview.journalAccounts.find(
          (a) => a.accountType === "Supplier_Payment"
        );

        if (fxAccount && partyJournalAccount) {
          const absFx = Math.abs(fxDiff);

          journalPreview.journalAccounts.push({
            counter: journalPreview.journalAccounts.length + 1,
            id: fxAccount._id,
            name: fxAccount.name,
            code: fxAccount.code,
            MainDebit: isLoss ? absFx : 0,
            MainCredit: isLoss ? 0 : absFx,
            accountDebit: isLoss ? absFx : 0,
            accountCredit: isLoss ? 0 : absFx,
            accountCurrency: fxAccount.currency?.currencyCode || "",
            accountExRate: Number(fxAccount.currency?.exchangeRate) || 1,
            isPrimary: fxAccount.currency?.is_primary === "true",
            Desc: `FX ${isLoss ? "Loss" : "Gain"} on payment`,
            accountType: isLoss ? "FX_Loss" : "FX_Gain",
          });

          journalPreview.journalAccounts.push({
            counter: journalPreview.journalAccounts.length + 1,
            id: partyJournalAccount.id,
            name: partyJournalAccount.name,
            code: partyJournalAccount.code,
            MainDebit: isLoss ? 0 : absFx,
            MainCredit: isLoss ? absFx : 0,
            accountDebit: isLoss ? 0 : absFx,
            accountCredit: isLoss ? absFx : 0,
            accountCurrency: partyJournalAccount.accountCurrency || "",
            accountExRate: partyJournalAccount.accountExRate || 1,
            isPrimary: partyJournalAccount.isPrimary || false,
            Desc: `FX ${isLoss ? "Loss" : "Gain"} offset`,
            accountType: "Supplier_Payment",
          });
        }
      }

      // ── Journal ────────────────────────────────────────────────
      if (journalPreview && nextCounterJournal) {
        await createJournalEntryService({
          data: {
            ...journalPreview.journalMeta,
            journalAccounts: journalPreview.journalAccounts,
            counter: req.body.counter || 0,
            refId: newPurchaseInvoice._id,
            refCounter: newPurchaseInvoice.counter,
          },
          companyId,
          nextCounterJournal,
          session,
        });
      }
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
| Update Posted Purchase Invoice 
|--------------------------------------------------------------------------
*/

exports.updatePostedPurchaseInvoice = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  const invoiceId = req.params.id;

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const purchaseInvoice = await purchaseinvoicesModel
      .findOne({ _id: invoiceId, companyId })
      .session(session);

    if (!purchaseInvoice)
      return next(new ApiError("Purchase invoice not found", 404));

    if (purchaseInvoice.isDraft === true || purchaseInvoice.status === "draft")
      return next(
        new ApiError("Draft purchase invoice should use draft update flow", 400)
      );

    if (purchaseInvoice.status === "cancelled")
      return next(
        new ApiError("Cancelled purchase invoice cannot be updated", 400)
      );

    if (purchaseInvoice.auditing === true)
      return next(
        new ApiError("Audited purchase invoice cannot be updated", 400)
      );

    if (
      purchaseInvoice.paid === "paid" ||
      (purchaseInvoice.payments || []).length > 0
    )
      return next(
        new ApiError(
          "Paid purchase invoice cannot be updated in this step",
          400
        )
      );

    const padZero = (v) => String(v).padStart(2, "0");
    const padMs = (v) => String(v).padStart(3, "0");
    const now = new Date();
    const updateDate = `${now.getFullYear()}-${padZero(
      now.getMonth() + 1
    )}-${padZero(now.getDate())}T${padZero(now.getHours())}:${padZero(
      now.getMinutes()
    )}:${padZero(now.getSeconds())}.${padMs(now.getMilliseconds())}Z`;

    /*
    |--------------------------------------------------------------------------
    | REVERSE OLD POSTED EFFECTS
    |--------------------------------------------------------------------------
    */
    const oldPrepared = await preparePurchaseInvoiceDataFromDraftService({
      purchaseInvoice,
      companyId,
      session,
    });

    await reversePurchaseInventoryEffectsService({
      ...oldPrepared,
      purchaseInvoice,
      companyId,
      session,
      reversedBy: req.user._id,
      reverseReason: "Purchase invoice update reversal",
      cancellationDate: updateDate,
      mode: "reverse_update",
    });

    await reversePurchaseSupplierEffectsService({
      ...oldPrepared,
      purchaseInvoice,
      companyId,
      session,
      cancellationDate: updateDate,
      mode: "reverse_update",
    });

    const counterFormat = req.body.counterFormat;
    await reversePurchaseJournalEffectsService({
      purchaseInvoice,
      companyId,
      session,
      cancellationDate: updateDate,
      counterFormat,
      mode: "reverse_update",
    });

    /*
    |--------------------------------------------------------------------------
    | PREPARE NEW REQUEST DATA
    |--------------------------------------------------------------------------
    */
    const newPrepared = await preparePurchaseInvoiceDataService({
      req,
      companyId,
      session,
    });

    /*
    |--------------------------------------------------------------------------
    | PAYMENT COUNTER — only if new version will create payment
    |--------------------------------------------------------------------------
    */
    let nextCounterPayment = null;

    if (req.body.paid === "paid") {
      const paymentSeq = await getNextCounterValue({
        companyId,
        name: "Payment",
        session,
      });
      nextCounterPayment = { seq: paymentSeq };
    }

    /*
    |--------------------------------------------------------------------------
    | UPDATE SAME INVOICE RECORD
    |--------------------------------------------------------------------------
    */
    const updatedPurchaseInvoice = await upsertPurchaseInvoiceRecordService({
      mode: "update",
      req,
      existingInvoice: purchaseInvoice,
      invoiceDraft: false,
      ...newPrepared,
      companyId,
      nextCounterPayment,
      draftJournalSnapshot: null,
      nextCounterPurchaseInvoices: null,
      session,
    });

    /*
    |--------------------------------------------------------------------------
    | REAPPLY NEW POSTED EFFECTS
    |--------------------------------------------------------------------------
    */
    await applyPurchaseInventoryEffectsService({
      ...newPrepared,
      newPurchaseInvoice: updatedPurchaseInvoice,
      companyId,
      date: updatedPurchaseInvoice.date,
      session,
    });

    await applyPurchaseSupplierEffectsService({
      ...newPrepared,
      newPurchaseInvoice: updatedPurchaseInvoice,
      companyId,
      date: updatedPurchaseInvoice.date,
      totalPurchasePriceMainCurrency:
        updatedPurchaseInvoice.totalPurchasePriceMainCurrency,
      totalRemainderMainCurrency:
        updatedPurchaseInvoice.totalRemainderMainCurrency,
      paid: updatedPurchaseInvoice.paid,
      session,
    });

    /*
    |--------------------------------------------------------------------------
    | RECREATE JOURNAL FOR UPDATED VERSION
    |--------------------------------------------------------------------------
    */
    const journalPreview =
      typeof req.body.journalPreview === "string"
        ? JSON.parse(req.body.journalPreview)
        : req.body.journalPreview;

    if (!journalPreview?.journalMeta)
      return next(new ApiError("journal preview is required", 400));

    const journalLinkCounter = `purchase-${
      updatedPurchaseInvoice._id
    }-${Date.now()}`;

    const { createdJournal } = await debugAndCreatePurchaseDraftJournalService({
      companyId,
      purchaseInvoice: updatedPurchaseInvoice,
      journalPreview,
      counterFormat,
      invoiceRefCounter: updatedPurchaseInvoice.counter,
      journalLinkCounter,
      session,
    });

    /*
    |--------------------------------------------------------------------------
    | PAYMENT — replaced paymentService with handlePurchasePayment
    |--------------------------------------------------------------------------
    */
    if (req.body.havepayments === "paid") {
      const fund = req.body.fund ? JSON.parse(req.body.fund) : null;
      const payment = req.body.payment ? JSON.parse(req.body.payment) : null;

      const normalizedPayment = {
        party: {
          id: newPrepared.supplier?._id?.toString() || "",
          name: newPrepared.supplier?.name || "",
          type: "supplier",
        },
        fund: {
          id: fund?.id || fund?._id || "",
          name: fund?.name || "",
          currencyId: fund?.currencyId || "",
          currencyCode: fund?.currencyCode || "",
          exchangeRate: Number(fund?.exchangeRate || 1),
        },
        paymentNature: "outgoing",
        payment: {
          amount: Number(payment?.amount || 0),
          currencyId: payment?.currencyId || "",
          currencyCode: payment?.currencyCode || "",
          exchangeRate: Number(payment?.exchangeRate || 1),
          amountMainCurrency: Number(payment?.amountMainCurrency || 0),
          amountInvoiceCurrency: Number(payment?.amountInvoiceCurrency || 0),
        },
        invoiceId: updatedPurchaseInvoice._id, // ← updated invoice
        date: req.body.paymentDate || updateDate,
        description: req.body.description || "",
        journalCounter: req.body.journalCounter || "",
        counter: req.body.counter || "0",
        companyId,
        postedBy: req.user?._id || null,
        postedAt: new Date(),
        journalAccounts: req.body.journalAccounts || null,
      };

      await handlePurchasePayment(
        req,
        companyId,
        next,
        normalizedPayment,
        session // ← pass existing session
      );
    }

    updatedPurchaseInvoice.journalCounter = journalLinkCounter;
    await updatedPurchaseInvoice.save({ session });

    /*
    |--------------------------------------------------------------------------
    | HISTORY
    |--------------------------------------------------------------------------
    */
    await createInvoiceHistory(
      companyId,
      updatedPurchaseInvoice._id,
      "edit",
      req.user._id,
      updateDate,
      "Purchase invoice updated",
      "purchase",
      session
    );

    if (updatedPurchaseInvoice.paid === "paid") {
      await createInvoiceHistory(
        companyId,
        updatedPurchaseInvoice._id,
        "payment",
        req.user._id,
        req.body.paymentDate || updateDate,
        "Invoice payment recorded from update",
        "purchase",
        session
      );
    }

    await session.commitTransaction();

    res.status(200).json({
      status: "success",
      message: "Purchase invoice updated successfully",
      data: updatedPurchaseInvoice,
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
| Cancel Posted Purchase Invoice 
|--------------------------------------------------------------------------
*/
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
    const baseCounter = Number(req.body.counter || 0);
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
      companyId,
      purchaseInvoice,
      session,
      counterFormat: baseCounter,
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

    // ── Journal ────────────────────────────────────────────────────
    const { createdJournal } = await debugAndCreatePurchaseDraftJournalService({
      companyId,
      purchaseInvoice,
      journalPreview,
      counterFormat: baseCounter,
      invoiceRefCounter: finalPurchaseCounter,
      journalLinkCounter: journalLink,
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

exports.updatePurchaseDraftInvoice = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

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
