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
} = require("../../../services/Accounting/Expenses/Expenses.service");
const expensesModel = require("../../../models/expensesModel");
const {
  createInvoiceHistory,
} = require("../../../services/invoiceHistoryService");
const { getNextCounterValue } = require("../../../utils/getNextCounterValue");

exports.findAllExpensesInvoices = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

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
  const companyId = req.companyId;

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
  const companyId = req.companyId;
  const invoiceDraft = req.body.isDraft === "true";
  const isCash = req.body.isCash === "true";

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    let nextCounterPayment = null;
    let nextCounterExpensesInvoices = null;

    if (!invoiceDraft) {
      nextCounterPayment = await counterModel.findOneAndUpdate(
        { companyId, name: "Payment" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, session },
      );

      nextCounterExpensesInvoices = await counterModel.findOneAndUpdate(
        { companyId, name: "Expenses" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, session },
      );
    }

    const prepared = await prepareExpensesDataService({
      req,
      companyId,
      session,
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

    if (!invoiceDraft && !isCash) {
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
  const companyId = req.companyId;
  const invoiceId = req.params.id;

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
        new ApiError("Audited expense invoice cannot be cancelled", 400),
      );
    }

    if (
      expense.paymentStatus === "paid" ||
      (expense.payments || []).length > 0
    ) {
      return next(
        new ApiError(
          "Paid expense invoice cannot be cancelled in this step",
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
      session,
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
  const companyId = req.companyId;
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
        new ApiError("Draft expense invoice should use draft update flow", 400),
      );
    }

    if (expenseInvoice.status === "cancelled") {
      return next(
        new ApiError("Cancelled expense invoice cannot be updated", 400),
      );
    }

    if (expenseInvoice.auditing === true) {
      return next(
        new ApiError("Audited expense invoice cannot be updated", 400),
      );
    }

    if (
      expenseInvoice.paymentStatus === "paid" ||
      (expenseInvoice.payments || []).length > 0
    ) {
      return next(
        new ApiError(
          "Paid expense invoice cannot be updated in this step",
          400,
        ),
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
      session,
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
        session,
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
