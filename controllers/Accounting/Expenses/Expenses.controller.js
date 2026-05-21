const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const ApiError = require("../../../utils/apiError");
const counterModel = require("../../../models/Settings/counterModel");
const {
  createExpensesInvoiceRecordService,
  prepareExpensesDataService,
  applyExpenseSupplierEffectsService,
  findAllExpensesInvoicesService,
  findOneExpenseInvoiceService,
  prepareExpenseDataFromDraftService,
  reverseExpenseSupplierEffectsService,
  reverseExpenseJournalEffectsService,
  upsertExpenseInvoiceRecordService,
  prepareExpenseInvoiceDataService,
  reverseExpenseNoSupplierEffectsService,
  getExpenseAndPurchaseForSupplierService,
} = require("../../../services/Accounting/Expenses/Expenses.service");
const expensesModel = require("../../../models/Accounting/Expenses/expensesModel");
const {
  createInvoiceHistory,
} = require("../../../services/invoiceHistoryService");
const { getNextCounterValue } = require("../../../utils/getNextCounterValue");
const {
  handleExpensePayment,
} = require("../../../services/Accounting/CurrentAssets/Payments/Payment.handlers");
const {
  createJournalEntryService,
} = require("../../../services/Accounting/JournalEntries/journalEntries.Service");
const linkPanelModel = require("../../../models/linkPanelModel");

exports.findAllExpensesInvoices = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const { totalItems, totalPages, expenses } =
    await findAllExpensesInvoicesService({
      req,
      companyId,
    });

  res.status(200).json({
    status: "true",
    Pages: totalPages,
    results: totalItems,
    data: expenses,
  });
});

exports.findOneExpensesInvoice = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const { totalItems, totalPages, expense, invoiceHistory } =
    await findOneExpenseInvoiceService({
      req,
      companyId,
    });

  res.status(200).json({
    status: "true",
    Pages: totalPages,
    data: expense,
    history: invoiceHistory,
  });
});

exports.createExpenseInvoice = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  const invoiceDraft = req.body.isDraft === "true";
  const isCash = req.body.isCash === "true";

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    let nextCounterPayment = null;
    let nextCounterExpensesInvoices = null;
    let nextCounterJournal = null;

    if (!invoiceDraft) {
      nextCounterPayment = await counterModel.findOneAndUpdate(
        { companyId, name: "Payment" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, session }
      );
      nextCounterExpensesInvoices = await counterModel.findOneAndUpdate(
        { companyId, name: "Expenses" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, session }
      );
      nextCounterJournal = await counterModel.findOneAndUpdate(
        { companyId, name: "Journal" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, session }
      );
    }

    const prepared = await prepareExpensesDataService({
      req,
      companyId,
      session,
      isCash,
    });

    const newExpenseInvoice = await createExpensesInvoiceRecordService({
      req,
      invoiceDraft,
      ...prepared,
      companyId,
      nextCounterPayment,
      nextCounterExpensesInvoices,
      session,
    });

    if (!invoiceDraft) {
      // ── Supplier effects — only when NOT cash ──────────────────
      if (!isCash) {
        await applyExpenseSupplierEffectsService({
          ...prepared,
          newExpenseInvoice,
          companyId,
          date: req.body.date,
          expenceTotalMainCurrency: req.body.expenceTotalMainCurrency,
          totalRemainderMainCurrency: req.body.totalRemainderMainCurrency,
          paymentStatus: req.body.paymentStatus,
          session,
        });
      }

      // ── Parse journalPreview FIRST ─────────────────────────────
      // Parsed before payment so the FX-append block can mutate it.
      const journalPreview = req.body.journalPreview
        ? JSON.parse(req.body.journalPreview)
        : null;

      // ── Payment — runs for BOTH cash and non-cash ──────────────
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
            fundToInvoiceRate: Number(payment?.fundToInvoiceRate || 1),
            amountInvoiceCurrency: Number(payment?.amountInvoiceCurrency || 0),
          },
          invoiceId: newExpenseInvoice._id,
          date: req.body.paymentDate || req.body.date,
          description: req.body.description || "",
          journalCounter: req.body.journalCounter || "",
          counter: req.body.counter || "0",
          companyId,
          postedBy: req.user?._id || null,
          postedAt: new Date(),
          journalAccounts: null, // journal handled separately below
          isCash,
          userId: req.user?._id || null,
        };

        const result = await handleExpensePayment(
          req,
          companyId,
          next,
          normalizedPayment,
          session
        );

        fxDiff = result?.fxDiff || 0; // ← capture fxDiff
      }

      // ── Append FX lines to journalPreview if needed ───────────
      // Skipped for cash expenses — no Supplier_Payment line to offset,
      // and a cash expense has no FX (settled at creation rate).
      if (
        req.body.havepayments === "paid" &&
        !isCash &&
        journalPreview &&
        Math.abs(fxDiff) > 0.001
      ) {
        const linkings = await linkPanelModel
          .find({ companyId })
          .populate({
            path: "accountData",
            populate: { path: "currency" },
          })
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

      // ── Journal — same session, atomic with invoice + payment ──
      // Frontend builds preview and sends it as journalPreview
      // Backend just saves it (with FX lines appended above if any)
      if (journalPreview && nextCounterJournal) {
        await createJournalEntryService({
          data: {
            ...journalPreview.journalMeta,
            journalAccounts: journalPreview.journalAccounts,
            counter: req.body.counter || 0,
            refId: newExpenseInvoice._id, // ← real id now available
          },
          companyId,
          nextCounterJournal,
          session, // ← same transaction
        });
      }
    }

    await session.commitTransaction();

    res.status(201).json({
      status: "success",
      data: newExpenseInvoice,
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
});
exports.cancelExpenseInvoice = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  const invoiceId = req.params.id;
  console.log("Bodyy", req.body);
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const expense = await expensesModel
      .findOne({ _id: invoiceId, companyId })
      .session(session);

    if (!expense) {
      return next(new ApiError("Expense invoice not found", 404));
    }

    if (expense.isDraft === true || expense.status === "draft") {
      return next(new ApiError("Draft invoice cannot be cancelled", 400));
    }

    if (expense.status === "cancelled") {
      return next(new ApiError("Expense invoice is already cancelled", 400));
    }

    if (expense.auditing === true) {
      return next(
        new ApiError("Audited expense invoice cannot be cancelled", 400)
      );
    }

    // AFTER — blocks any payment (full or partial)
    const totalPaidMain =
      expense.expenceTotalMainCurrency - expense.totalRemainderMainCurrency;
    const hasPayments = (expense.payments || []).length > 0;
    const hasBeenPaid = totalPaidMain > 0.001;

    if (hasPayments || hasBeenPaid) {
      return next(
        new ApiError(
          `Cannot cancel — ${
            expense.paymentStatus === "paid"
              ? "invoice is fully paid"
              : `invoice has ${totalPaidMain.toFixed(
                  2
                )} ${primary_currency} in payments applied`
          }. Please reverse the payments first.`,
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

    const prepared = await prepareExpenseDataFromDraftService({
      expense,
      companyId,
      session,
    });

    await reverseExpenseSupplierEffectsService({
      ...prepared,
      expense,
      companyId,
      session,
      cancellationDate,
    });

    await reverseExpenseJournalEffectsService({
      companyId,
      expense,
      session,
      counterFormat: baseCounter,
      cancellationDate,
    });

    expense.status = "cancelled";
    expense.type = "Expense cancelled";
    expense.cancelledAt = cancellationDate;
    expense.cancelledBy = req.user._id;
    expense.cancellationReason = req.body.reason || "";

    await expense.save({ session });

    await createInvoiceHistory(
      companyId,
      expense._id,
      "cancel",
      req.user._id,
      cancellationDate,
      "Expenses cancelled",
      "expenses",
      session
    );

    await session.commitTransaction();

    res.status(200).json({
      status: "success",
      message: "Expenses invoice cancelled successfully",
      data: expense,
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
});

exports.updatePostedExpenseInvoice = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  const invoiceId = req.params.id;

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const expenseInvoice = await expensesModel
      .findOne({ _id: invoiceId, companyId })
      .session(session);

    if (!expenseInvoice) {
      return next(new ApiError("Expense invoice not found", 404));
    }

    if (expenseInvoice.isDraft === true || expenseInvoice.status === "draft") {
      return next(
        new ApiError("Draft expense invoice should use draft update flow", 400)
      );
    }

    if (expenseInvoice.status === "cancelled") {
      return next(
        new ApiError("Cancelled expense invoice cannot be updated", 400)
      );
    }

    if (expenseInvoice.auditing === true) {
      return next(
        new ApiError("Audited expense invoice cannot be updated", 400)
      );
    }

    if (
      expenseInvoice.paymentStatus === "paid" ||
      (expenseInvoice.payments || []).length > 0
    ) {
      return next(
        new ApiError("Paid expense invoice cannot be updated in this step", 400)
      );
    }

    const padZero = (value) => String(value).padStart(2, "0");
    const padMs = (value) => String(value).padStart(3, "0");

    const now = new Date();
    const updateDate = `${now.getFullYear()}-${padZero(
      now.getMonth() + 1
    )}-${padZero(now.getDate())}T${padZero(now.getHours())}:${padZero(
      now.getMinutes()
    )}:${padZero(now.getSeconds())}.${padMs(now.getMilliseconds())}Z`;

    const oldPrepared = await prepareExpenseDataFromDraftService({
      expense: expenseInvoice,
      companyId,
      session,
    });

    await reverseExpenseSupplierEffectsService({
      ...oldPrepared,
      expense: expenseInvoice,
      companyId,
      session,
      cancellationDate: updateDate,
      mode: "reverse_update",
    });
    const counterFormat = req.body.counterFormat;
    const reversalJournalLinkCounter = `${
      expenseInvoice.journalCounter
    }-reverse-update-${Date.now()}`;

    await reverseExpenseJournalEffectsService({
      expense: expenseInvoice,
      companyId,
      session,
      cancellationDate: updateDate,
      counterFormat,
      reversalJournalLinkCounter,
      mode: "reverse_update",
    });

    const newPrepared = await prepareExpenseInvoiceDataService({
      req,
      companyId,
      session,
    });

    let nextCounterPayment = null;

    if (req.body.paymentStatus === "paid") {
      const paymentSeq = await getNextCounterValue({
        companyId,
        name: "Payment",
        session,
      });

      nextCounterPayment = { seq: paymentSeq };
    }

    const updatedExpenseInvoice = await upsertExpenseInvoiceRecordService({
      mode: "update",
      req,
      existingInvoice: expenseInvoice,
      invoiceDraft: false,
      ...newPrepared,
      companyId,
      nextCounterPayment,
      draftJournalSnapshot: null,
      nextCounterPurchaseInvoices: null,
      session,
    });

    await applyExpenseSupplierEffectsService({
      ...newPrepared,
      newExpenseInvoice: updatedExpenseInvoice,
      companyId,
      date: updatedExpenseInvoice.date,
      totalPurchasePriceMainCurrency:
        updatedExpenseInvoice.totalPurchasePriceMainCurrency,
      totalRemainderMainCurrency:
        updatedExpenseInvoice.totalRemainderMainCurrency,
      paymentStatus: updatedExpenseInvoice.paymentStatus,
      session,
    });

    const journalPreview =
      typeof req.body.journalPreview === "string"
        ? JSON.parse(req.body.journalPreview)
        : req.body.journalPreview;

    if (!journalPreview?.journalMeta) {
      return next(new ApiError("journal preview is required", 400));
    }

    const journalLinkCounter = `purchase-${
      updatedExpenseInvoice._id
    }-${Date.now()}`;

    const { createdJournal } = await debugAndCreatePurchaseDraftJournalService({
      companyId,
      purchaseInvoice: updatedExpenseInvoice,
      journalPreview,
      counterFormat,
      invoiceRefCounter: updatedExpenseInvoice.counter,
      journalLinkCounter,
      session,
    });

    updatedExpenseInvoice.journalCounter = journalLinkCounter;

    await updatedExpenseInvoice.save({ session });

    await createInvoiceHistory(
      companyId,
      updatedExpenseInvoice._id,
      "edit",
      req.user._id,
      updateDate,
      "Purchase invoice updated",
      "purchase",
      session
    );

    if (updatedExpenseInvoice.paymentStatus === "paid") {
      await createInvoiceHistory(
        companyId,
        updatedExpenseInvoice._id,
        "payment",
        req.user._id,
        req.body.paymentDate || updateDate,
        "Invoice payment recorded from update",
        "expense",
        session
      );
    }

    await session.commitTransaction();

    res.status(200).json({
      status: "success",
      message: "Expense invoice updated successfully",
      data: updatedExpenseInvoice,
      journal: createdJournal,
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
});

exports.cancelNoSupplierExpense = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  const { id } = req.params;
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const padZero = (value) => String(value).padStart(2, "0");
    const padMs = (value) => String(value).padStart(3, "0");
    const now = new Date();
    const cancellationDate = `${now.getFullYear()}-${padZero(
      now.getMonth() + 1
    )}-${padZero(now.getDate())}T${padZero(now.getHours())}:${padZero(
      now.getMinutes()
    )}:${padZero(now.getSeconds())}.${padMs(now.getMilliseconds())}Z`;

    if (!companyId) {
      return res.status(400).json({ message: "companyId is required" });
    }
    const expense = await expensesModel
      .findOne({ _id: id, companyId })
      .session(session);
    if (!expense) {
      return next(new ApiError(`No expense found with id ${id}`, 404));
    }
    await reverseExpenseNoSupplierEffectsService({
      companyId,
      expense,
      cancellationDate,
      session,
      req,
    });
    await reverseExpenseJournalEffectsService({
      companyId,
      expense: expense,
      session,
      counterFormat: expense.counter,
      cancellationDate,
      reversalJournalLinkCounter: expense.counter,
      mode: "cancel",
    });

    await createInvoiceHistory(
      companyId,
      expense._id,
      "cancel",
      req.user._id,
      cancellationDate,
      "Cancelled Expense",
      "expense",
      session
    );

    await session.commitTransaction();
    res.status(200).json({ message: "Expense cancelled successfully" });
  } catch (e) {
    await session.abortTransaction();
    return next(new ApiError(`Error cancelling expense: ${e.message}`, 500));
  } finally {
    session.endSession();
  }
});

exports.findAllExpensesAndPurchaseInvoices = asyncHandler(
  async (req, res, next) => {
    const companyId = req.query.companyId;

    if (!companyId) {
      return res.status(400).json({ message: "companyId is required" });
    }

    const supplierId = req.params.id;

    const { totalItems, totalPages, data } =
      await getExpenseAndPurchaseForSupplierService({
        req,
        companyId,
        supplierId,
      });

    res.status(200).json({
      status: "true",
      Pages: totalPages,
      results: totalItems,
      data,
    });
  }
);
