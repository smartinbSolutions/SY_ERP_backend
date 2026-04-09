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

    const nextCounterPayment = await counterModel.findOneAndUpdate(
      { companyId, name: "payment" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session }
    );

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

    let financial = {
      payment: null,
      financialFund: null,
    };

    if (req.body.paid === "paid") {
      financial = await applyRefundPurchaseFinancialEffectsService({
        req,
        companyId,
        session,
        supplier: prepared.supplier,
        newRefundPurchaseInvoice,
        formattedDate: prepared.formattedDate,
        nextCounterPayment,
      });
    }

    await applyRefundPurchaseInventoryEffectsService({
      companyId,
      session,
      invoicesItems: prepared.invoicesItems,
      productMap: prepared.productMap,
      newRefundPurchaseInvoice,
    });

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
