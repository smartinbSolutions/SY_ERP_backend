const asyncHandler = require("express-async-handler");
const ApiError = require("../../../utils/apiError");
const mongoose = require("mongoose");

const {
  findAllPurchaseRefundsService,
  findOnePurchaseRefundService,
  findRefundablePurchaseItemsByInvoicesService,
  applyRefundPurchaseFinancialEffectsService,
  createRefundPurchaseInvoiceRecordService,
  prepareRefundPurchaseInvoiceDataService,
  applyRefundPurchaseSupplierEffectsService,
  applyRefundPurchaseInventoryEffectsService,
} = require("../../../services/Accounting/Purchase/PurchaseInvoice_Refund.service");

const counterModel = require("../../../models/Settings/counterModel");
const {
  handlePurchaseRefundPayment,
} = require("../../../services/Accounting/CurrentAssets/Payments/Payment.handlers");
const linkPanelModel = require("../../../models/linkPanelModel");
const {
  createJournalEntryService,
} = require("../../../services/Accounting/JournalEntries/journalEntries.Service");

exports.findAllPurchaseRefunds = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const { totalItems, totalPages, purchaseRefunds } =
    await findAllPurchaseRefundsService({
      req,
      companyId,
    });

  res.status(200).json({
    status: "success",
    results: purchaseRefunds.length,
    Pages: totalPages,
    totalItems,
    data: purchaseRefunds,
  });
});

exports.findOnePurchaseRefund = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const { totalItems, totalPages, purchaseRefund, invoiceHistory } =
    await findOnePurchaseRefundService({
      req,
      companyId,
    });

  res.status(200).json({
    status: "true",
    Pages: totalPages,
    totalItems,
    data: purchaseRefund,
    history: invoiceHistory,
  });
});

exports.findRefundablePurchaseItemsByInvoices = asyncHandler(
  async (req, res, next) => {
    const companyId = req.companyId;

    if (!companyId) {
      return res.status(400).json({ message: "companyId is required" });
    }

    const { refundableItems, purchaseInvoicesCount } =
      await findRefundablePurchaseItemsByInvoicesService({
        req,
        companyId,
      });

    res.status(200).json({
      status: "true",
      results: refundableItems.length,
      purchaseInvoicesCount,
      data: refundableItems,
    });
  },
);

exports.createRefundPurchaseInvoice = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // counter for refund invoice only — payment counter handled inside handler
    const nextCounterRefundPurchaseInvoice =
      await counterModel.findOneAndUpdate(
        { companyId, name: "refundPurchaseInvoice" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, session },
      );
    nextCounterJournal = await counterModel.findOneAndUpdate(
      { companyId, name: "Journal" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session },
    );

    const prepared = await prepareRefundPurchaseInvoiceDataService({
      req,
      companyId,
      session,
    });

    const newRefundPurchaseInvoice =
      await createRefundPurchaseInvoiceRecordService({
        req,
        companyId,
        session,
        supplierPayload: prepared.supplierPayload,
        invoicesItems: prepared.invoicesItems,
        sourcePurchaseInvoices: prepared.sourcePurchaseInvoices,
        formattedDate: prepared.formattedDate,
        nextCounterRefundPurchaseInvoice,
      });

    // ── Inventory effects ──────────────────────────────────────
    await applyRefundPurchaseInventoryEffectsService({
      companyId,
      session,
      invoicesItems: prepared.invoicesItems,
      productMap: prepared.productMap,
      newRefundPurchaseInvoice,
    });

    // ── Supplier balance effects ───────────────────────────────
    await applyRefundPurchaseSupplierEffectsService({
      supplier: prepared.supplier,
      newRefundPurchaseInvoice,
      companyId,
      currency: req.body.currency,
      session,
    });
    console.log(req.body);
    // ── Parse journalPreview FIRST ─────────────────────────────
    const journalPreview = req.body.journalPreview;

    // ── Payment ────────────────────────────────────────────────
    let fxDiff = 0; // ← declare outside so it's accessible below
    // ── Payment — replaced applyRefundPurchaseFinancialEffectsService ──
    if (req.body.paid === "paid") {
      const fund = req.body.fund;
      const payment = req.body.payment;

      const normalizedPayment = {
        party: {
          id: prepared.supplier?._id?.toString() || "",
          name:
            prepared.supplier?.supplierName || prepared.supplier?.name || "",
          type: "supplier",
        },
        fund: {
          id: fund?.id || fund?._id || "",
          name: fund?.name || "",
          currencyId: fund?.currencyId || "",
          currencyCode: fund?.code || fund?.currencyCode || "",
          exchangeRate: Number(fund?.exchangeRate || 1),
        },
        paymentNature: "incoming", // ← refund = money coming IN from supplier
        payment: {
          amount: Number(payment?.amount || 0),
          currencyId: payment?.currencyId || "",
          currencyCode: payment?.currencyCode || "",
          exchangeRate: Number(payment?.exchangeRate || 1),
          amountMainCurrency: Number(payment?.amountMainCurrency || 0),
          fundToInvoiceRate: Number(payment?.fundToInvoiceRate || 1),
          amountInvoiceCurrency: Number(payment?.amountInvoiceCurrency || 0),
        },
        invoiceId: newRefundPurchaseInvoice._id,
        date: req.body.paymentDate || prepared.formattedDate,
        description: req.body.paymentDescription || "",
        journalCounter: req.body.journalCounter || "",
        counter: req.body.counter || "0",
        companyId,
        postedBy: req.user?._id || null,
        postedAt: new Date(),
        journalAccounts: req.body.journalAccounts || null,
      };
      console.log("normalizedPayment", normalizedPayment);
      const result = await handlePurchaseRefundPayment(
        req,
        companyId,
        next,
        normalizedPayment,
        session,
      );

      fxDiff = result.fxDiff || 0;
    }

    // ── Append FX lines to journalPreview if needed ───────────
    if (
      req.body.paid === "paid" &&
      journalPreview &&
      Math.abs(fxDiff) > 0.001
    ) {
      const linkings = await linkPanelModel
        .find({ companyId })
        .populate("accountData")
        .session(session);

      const fxGainLink = linkings.find(
        (l) => l.name === "Foreign Exchange Gain",
      );
      const fxLossLink = linkings.find(
        (l) => l.name === "Foreign Exchange Loss",
      );

      const isLoss = fxDiff < 0.0;
      const fxAccount = isLoss
        ? fxLossLink?.accountData
        : fxGainLink?.accountData;
      const partyJournalAccount = journalPreview.journalAccounts.find(
        (a) => a.accountType === "Supplier_Payment",
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
          refId: newRefundPurchaseInvoice._id,
          refCounter: newRefundPurchaseInvoice.counter,
        },
        companyId,
        nextCounterJournal,
        session,
      });
    }

    await session.commitTransaction();

    res.status(201).json({
      status: "success",
      data: newRefundPurchaseInvoice,
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
});
