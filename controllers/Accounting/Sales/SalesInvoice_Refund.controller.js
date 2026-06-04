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
const orderModel = require("../../../models/Accounting/Sales/orderModel");
const ApiError = require("../../../utils/apiError");
const {
  createJournalEntryService,
} = require("../../../services/Accounting/JournalEntries/journalEntries.Service");
const {
  handleSalesPayment,
  handleRefundSalesPayment,
} = require("../../../services/Accounting/CurrentAssets/Payments/Payment.handlers");

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
    let nextCounterJournal = null;
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

    nextCounterJournal = await counterModel.findOneAndUpdate(
      { companyId, name: "Journal" },
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
      updateDate,
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
    const journalPreview = req.body.journalPreview
      ? JSON.parse(req.body.journalPreview)
      : null;

    let fxDiff = 0;

    if (req.body.havepayments === "paid") {
      const fund = req.body.fund ? JSON.parse(req.body.fund) : null;
      const payment = req.body.payment ? JSON.parse(req.body.payment) : null;

      const normalizedPayment = {
        party: {
          id: prepared.customer?._id?.toString() || "",
          name: prepared.customer?.name || "",
          type: "customer",
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
        invoiceId: newRefundSalesInvoice._id,
        date: req.body.paymentDate || req.body.date || updateDate,
        description: req.body.paymentDescription || req.body.description || "",
        journalCounter: req.body.journalCounter || "",
        counter: req.body.counter || "0",
        companyId,
        postedBy: req.user?._id || null,
        postedAt: new Date(),
        journalAccounts: null,
      };

      const result = await handleRefundSalesPayment(
        req,
        companyId,
        next,
        normalizedPayment,
        session,
      );

      fxDiff = result?.fxDiff || 0;
    }

    if (
      req.body.havepayments === "paid" &&
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
        (l) => l.name === "Foreign Exchange Gain",
      );
      const fxLossLink = linkings.find(
        (l) => l.name === "Foreign Exchange Loss",
      );

      const isLoss = fxDiff < 0;
      const fxAccount = isLoss
        ? fxLossLink?.accountData
        : fxGainLink?.accountData;

      const partyJournalAccount = journalPreview.journalAccounts.find(
        (a) => a.accountType === "Customer_Payment",
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
          accountType: "Customer_Payment",
        });
      }
    }

    if (journalPreview && nextCounterJournal) {
      await createJournalEntryService({
        data: {
          ...journalPreview.journalMeta,
          journalAccounts: journalPreview.journalAccounts,
          counter: req.body.counter || 0,
          refId: newRefundSalesInvoice._id,
          refCounter: newRefundSalesInvoice.counter,
        },
        companyId,
        nextCounterJournal,
        session,
      });
    }
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
