const mongoose = require("mongoose");
const PaymentHistoryModel = require("../models/paymentHistoryModel");
const ApiError = require("../utils/apiError");
const asyncHandler = require("express-async-handler");

const createPaymentHistory = async (
  type,
  date,
  rest,
  amount,
  taker,
  id,
  ref,
  companyId,
  description,
  idPaymet,
  paymentText,
  refText,
  transactionCurrency,
  session = null
) => {
  try {
    const normalizedDate = date
      ? new Date(date).toISOString()
      : new Date().toISOString();

    const newPaymentHistoryData = {
      companyId,
      type,
      date: normalizedDate,
      rest,
      amount,
      ref,
      description,
      idPaymet,
      paymentText,
      refText,
      transactionCurrency,
    };

    if (taker === "supplier") {
      newPaymentHistoryData.supplierId = id;
    } else {
      newPaymentHistoryData.customerId = id;
    }

    const newPaymentHistory = new PaymentHistoryModel(newPaymentHistoryData);

    const savedPaymentHistory = session
      ? await newPaymentHistory.save({ session })
      : await newPaymentHistory.save();

    return savedPaymentHistory;
  } catch (error) {
    throw new ApiError(`Error creating payment history: ${error.message}`, 500);
  }
};

const createPaymentHistoryV2 = async ({
  companyId,
  entryType,
  transactionDate,
  amountTransactionCurrency,
  amountMainCurrency,
  supplierId,
  customerId,
  referenceId,
  sourceModule,
  actionType,
  paymentId,
  balanceEffectType,
  description,
  transactionCurrency,
  session = null,
}) => {
  try {
    const normalizedTransactionDate = transactionDate
      ? new Date(transactionDate).toISOString()
      : new Date().toISOString();

    if (!supplierId && !customerId) {
      throw new ApiError("Either supplierId or customerId is required", 400);
    }

    if (supplierId && customerId) {
      throw new ApiError(
        "Only one of supplierId or customerId should be provided",
        400
      );
    }

    const newPaymentHistoryData = {
      companyId,
      entryType,
      transactionDate: normalizedTransactionDate,
      amountTransactionCurrency: Number(amountTransactionCurrency || 0),
      amountMainCurrency: Number(amountMainCurrency || 0),
      referenceId,
      sourceModule,
      actionType,
      paymentId,
      balanceEffectType,
      description,
      transactionCurrency,
      ...(supplierId ? { supplierId } : {}),
      ...(customerId ? { customerId } : {}),
    };

    const newPaymentHistory = new PaymentHistoryModel(newPaymentHistoryData);

    return session
      ? await newPaymentHistory.save({ session })
      : await newPaymentHistory.save();
  } catch (error) {
    throw new ApiError(`Error creating payment history: ${error.message}`, 500);
  }
};

const getPaymentHistory = asyncHandler(async (req, res, next) => {
  const pageSize = parseInt(req.query.limit, 10) || 10;
  const page = parseInt(req.query.page, 10) || 1;
  const skip = (page - 1) * pageSize;
  const companyId = req.query.companyId;
  const { id } = req.params;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const query = {
    companyId,
    $or: [{ customerId: id }, { supplierId: id }],
  };

  const allTransactions = await PaymentHistoryModel.find(query)
    .lean()
    .sort({ date: 1, createdAt: 1 });

  const getPartyRole = (transaction, partyId) => {
    if (
      transaction.customerId &&
      String(transaction.customerId) === String(partyId)
    ) {
      return "customer";
    }

    if (
      transaction.supplierId &&
      String(transaction.supplierId) === String(partyId)
    ) {
      return "supplier";
    }

    return null;
  };

  const getTransactionEffect = (transaction, role) => {
    const rest = Number(transaction.rest || 0);

    if (!role || rest === 0) return 0;

    const type = String(transaction.type || "").trim();
    const paymentText = String(transaction.paymentText || "").trim();

    // reversals / cancellations
    if (
      type === "invoice_cancel" ||
      type === "invoice_reverse_update" ||
      type === "refund_invoice"
    ) {
      return -rest;
    }

    // opening balance
    if (type === "Opening balance") {
      if (role === "customer") {
        return paymentText === "Deposit" ? -rest : +rest;
      }

      if (role === "supplier") {
        return paymentText === "Deposit" ? +rest : -rest;
      }
    }

    // payments / refunds
    if (type === "payment" || type === "Refund Invoice") {
      if (role === "customer") {
        if (paymentText === "Deposit") return -rest;
        if (paymentText === "Withdrawal") return -rest;
      }

      if (role === "supplier") {
        if (paymentText === "Deposit") return -rest;
        if (paymentText === "Withdrawal") return +rest;
      }
    }

    // default invoice-like behavior
    return +rest;
  };

  let runningBalance = 0;

  const transactionsWithBalance = allTransactions.map((transaction) => {
    const role = getPartyRole(transaction, id);
    const effect = getTransactionEffect(transaction, role);

    runningBalance += effect;

    return {
      ...transaction,
      runningBalance,
      balanceEffect: effect, // optional, useful for debugging
      partyType: role, // optional, useful for frontend/debugging
    };
  });

  const sortedTransactions = [...transactionsWithBalance].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );

  const paginatedTransactions = sortedTransactions.slice(skip, skip + pageSize);

  const totalItems = transactionsWithBalance.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  res.status(200).json({
    status: "true",
    pages: totalPages,
    results: paginatedTransactions.length,
    data: paginatedTransactions,
  });
});

const editPaymentHistory = async (
  dbName,
  openingBalanceId,
  openingBalance,
  date,
  amountBalance
) => {
  const db = mongoose.connection.useDb(dbName);
  const PaymentHistoryModel = db.model("PaymentHistory", PaymentHistorySchema);
  const paymentHistory = await PaymentHistoryModel.findOne({
    _id: openingBalanceId,
  });

  paymentHistory.rest = openingBalance;
  paymentHistory.amount = amountBalance;
  paymentHistory.date = date;
  paymentHistory.save();
  return paymentHistory;
};

module.exports = {
  createPaymentHistory,
  getPaymentHistory,
  editPaymentHistory,
  createPaymentHistoryV2,
};
