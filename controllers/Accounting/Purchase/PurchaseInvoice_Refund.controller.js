const asyncHandler = require("express-async-handler");
const {
  findAllPurchaseRefundsService,
  findOnePurchaseRefundService,
  findRefundablePurchaseItemsByInvoicesService,
} = require("../../../services/Accounting/Purchase/PurchaseInvoice_Refund.service");

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
