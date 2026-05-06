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
  handlePurchasePayment,
} = require("../../../services/Accounting/CurrentAssets/Payments/Payment.handlers");

exports.findAllPurchaseRefunds = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

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
  const companyId = req.query.companyId;

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
    const companyId = req.query.companyId;

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
  }
);

exports.createRefundPurchaseInvoice = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

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
        { new: true, upsert: true, session }
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

    // ── Payment — replaced applyRefundPurchaseFinancialEffectsService ──
    if (req.body.paid === "paid") {
      const fund = req.body.financailFund
        ? typeof req.body.financailFund === "string"
          ? JSON.parse(req.body.financailFund)
          : req.body.financailFund
        : null;

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
          amount: Number(req.body.paymentInFundCurrency || 0),
          currencyId: fund?.currencyId || "",
          currencyCode: fund?.code || fund?.currencyCode || "",
          exchangeRate: Number(fund?.exchangeRate || 1),
          amountMainCurrency: Number(req.body.paymentInMainCurrency || 0),
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

      await handlePurchasePayment(
        req,
        companyId,
        next,
        normalizedPayment,
        session // ← pass existing session, no nested transaction
      );
    }

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
