const mongoose = require("mongoose");
const PaymentHistoryModel = require("../models/paymentHistoryModel");
const ApiError = require("../utils/apiError");

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

// const getPaymentHistory = async (req, res, next) => {
//   const pageSize = parseInt(req.query.limit, 10) || 10;
//   const page = parseInt(req.query.page, 10) || 1;
//   const skip = (page - 1) * pageSize;
//   const companyId = req.query.companyId;
//   const { id } = req.params;

//   if (!companyId) {
//     return res.status(400).json({ message: "companyId is required" });
//   }

//   const query = {
//     companyId,
//     $or: [{ customerId: id }, { supplierId: id }],
//   };

//   const round = (num) => Number(Number(num || 0).toFixed(2));

//   const sortAsc = (a, b) => {
//     const transactionDiff =
//       new Date(a.transactionDate || 0) - new Date(b.transactionDate || 0);

//     if (transactionDiff !== 0) return transactionDiff;

//     return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
//   };

//   const sortDesc = (a, b) => {
//     const transactionDiff =
//       new Date(b.transactionDate || 0) - new Date(a.transactionDate || 0);

//     if (transactionDiff !== 0) return transactionDiff;

//     return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
//   };

//   const getPartyRole = (transaction, partyId) => {
//     if (
//       transaction.customerId &&
//       String(transaction.customerId) === String(partyId)
//     ) {
//       return "customer";
//     }

//     if (
//       transaction.supplierId &&
//       String(transaction.supplierId) === String(partyId)
//     ) {
//       return "supplier";
//     }

//     return null;
//   };

//   const getTransactionEffect = (transaction, role) => {
//     const amountMainCurrency = Number(transaction.amountMainCurrency || 0);

//     if (!role || amountMainCurrency === 0) return 0;

//     const entryType = String(transaction.entryType || "").trim();
//     const sourceModule = String(transaction.sourceModule || "").trim();
//     const actionType = String(transaction.actionType || "").trim();
//     const balanceEffectType = String(
//       transaction.balanceEffectType || ""
//     ).trim();

//     if (entryType === "payment") {
//       if (role === "supplier") {
//         if (balanceEffectType === "Deposit") return -amountMainCurrency;
//         if (balanceEffectType === "Withdrawal") return +amountMainCurrency;
//       }

//       if (role === "customer") {
//         if (balanceEffectType === "Deposit") return +amountMainCurrency;
//         if (balanceEffectType === "Withdrawal") return -amountMainCurrency;
//       }

//       return 0;
//     }

//     if (entryType === "invoice") {
//       if (role === "supplier" && sourceModule === "purchase") {
//         if (actionType === "create") return +amountMainCurrency;
//         if (actionType === "refund") return -amountMainCurrency;
//         if (actionType === "cancel") return -amountMainCurrency;
//         if (actionType === "update") return -amountMainCurrency;
//       }

//       if (role === "customer" && sourceModule === "sales") {
//         if (actionType === "create") return +amountMainCurrency;
//         if (actionType === "refund") return -amountMainCurrency;
//         if (actionType === "cancel") return -amountMainCurrency;
//         if (actionType === "update") return -amountMainCurrency;
//       }

//       return 0;
//     }

//     if (entryType === "fx_adjustment") {
//       if (role === "supplier") {
//         if (balanceEffectType === "Withdrawal") return +amountMainCurrency; // FX Loss
//         if (balanceEffectType === "Deposit") return -amountMainCurrency; // FX Gain
//       }

//       if (role === "customer") {
//         if (balanceEffectType === "Withdrawal") return -amountMainCurrency;
//         if (balanceEffectType === "Deposit") return +amountMainCurrency;
//       }

//       return 0;
//     }

//     if (entryType === "expense") {
//       if (role === "supplier" && sourceModule === "expense") {
//         if (actionType === "create") return +amountMainCurrency;
//         if (actionType === "cancel") return -amountMainCurrency;
//         if (actionType === "update") return -amountMainCurrency;
//       }

//       return 0;
//     }

//     if (entryType === "opening_balance") {
//       if (role === "supplier") {
//         if (balanceEffectType === "Deposit") return -amountMainCurrency;
//         if (balanceEffectType === "Withdrawal") return +amountMainCurrency;
//       }

//       if (role === "customer") {
//         if (balanceEffectType === "Deposit") return +amountMainCurrency;
//         if (balanceEffectType === "Withdrawal") return -amountMainCurrency;
//       }

//       return 0;
//     }

//     return 0;
//   };

//   const allTransactions = await PaymentHistoryModel.find(query).lean();

//   const orderedTransactions = [...allTransactions].sort(sortAsc);

//   let runningBalance = 0;

//   const transactionsWithBalance = orderedTransactions.map((transaction) => {
//     const role = getPartyRole(transaction, id);
//     const effect = round(getTransactionEffect(transaction, role));

//     runningBalance = round(runningBalance + effect);

//     return {
//       ...transaction,
//       runningBalance,
//       balanceEffect: effect,
//       partyType: role,
//     };
//   });

//   const sortedTransactions = [...transactionsWithBalance].sort(sortDesc);
//   const paginatedTransactions = sortedTransactions.slice(skip, skip + pageSize);

//   const totalItems = transactionsWithBalance.length;
//   const totalPages = Math.ceil(totalItems / pageSize);

//   res.status(200).json({
//     status: "true",
//     pages: totalPages,
//     results: paginatedTransactions.length,
//     data: paginatedTransactions,
//   });
// };
const getPaymentHistory = async (req, res, next) => {
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

  const round = (num) => Number(Number(num || 0).toFixed(2));

  const sortAsc = (a, b) => {
    const diff =
      new Date(a.transactionDate || 0) - new Date(b.transactionDate || 0);
    if (diff !== 0) return diff;
    return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
  };

  const sortDesc = (a, b) => {
    const diff =
      new Date(b.transactionDate || 0) - new Date(a.transactionDate || 0);
    if (diff !== 0) return diff;
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  };

  const getPartyRole = (tx, partyId) => {
    if (String(tx.customerId) === String(partyId)) return "customer";
    if (String(tx.supplierId) === String(partyId)) return "supplier";
    return null;
  };

  const getTransactionEffect = (tx, role) => {
    const amount = Number(tx.amountMainCurrency || 0);
    if (!role || !amount) return 0;

    const entryType = tx.entryType?.trim();
    const sourceModule = tx.sourceModule?.trim();
    const actionType = tx.actionType?.trim();
    const balanceEffectType = tx.balanceEffectType?.trim();

    if (entryType === "payment") {
      if (role === "supplier") {
        if (balanceEffectType === "Deposit") return -amount;
        if (balanceEffectType === "Withdrawal") return +amount;
      }

      if (role === "customer") {
        if (balanceEffectType === "Deposit") return +amount;
        if (balanceEffectType === "Withdrawal") return -amount;
      }
    }

    if (entryType === "invoice") {
      if (role === "supplier" && sourceModule === "purchase") {
        if (actionType === "create") return +amount;
        if (["refund", "cancel", "update"].includes(actionType)) return -amount;
      }

      if (role === "customer" && sourceModule === "sales") {
        if (actionType === "create") return +amount;
        if (["refund", "cancel", "update"].includes(actionType)) return -amount;
      }
    }

    if (entryType === "fx_adjustment") {
      if (role === "supplier") {
        if (balanceEffectType === "Withdrawal") return +amount;
        if (balanceEffectType === "Deposit") return -amount;
      }

      if (role === "customer") {
        if (balanceEffectType === "Withdrawal") return -amount;
        if (balanceEffectType === "Deposit") return +amount;
      }
    }

    if (entryType === "expense") {
      if (role === "supplier" && sourceModule === "expense") {
        if (actionType === "create") return +amount;
        if (["cancel", "update"].includes(actionType)) return -amount;
      }
    }

    if (entryType === "opening_balance") {
      if (role === "supplier") {
        if (balanceEffectType === "Deposit") return -amount;
        if (balanceEffectType === "Withdrawal") return +amount;
      }

      if (role === "customer") {
        if (balanceEffectType === "Deposit") return +amount;
        if (balanceEffectType === "Withdrawal") return -amount;
      }
    }

    return 0;
  };

  const allTransactions = await PaymentHistoryModel.find(query).lean();
  const orderedTransactions = [...allTransactions].sort(sortAsc);

  let runningBalance = 0;

  let totalIn = 0;
  let totalOut = 0;
  let totalActivity = 0;

  // NEW breakdown counters
  let invoices = 0;
  let payments = 0;
  let expenses = 0;
  let fxAdjustments = 0;
  let openingBalances = 0;

  const transactionsWithBalance = orderedTransactions.map((tx) => {
    const role = getPartyRole(tx, id);
    const effect = round(getTransactionEffect(tx, role));
    const amount = Number(tx.amountMainCurrency || 0);

    // ─────────────────────────────
    // RUNNING BALANCE
    // ─────────────────────────────
    runningBalance = round(runningBalance + effect);

    // ─────────────────────────────
    // CASH FLOW (PAYMENTS ONLY)
    // ─────────────────────────────
    if (tx.entryType === "payment") {
      payments += amount;

      if (tx.balanceEffectType === "Deposit") {
        totalOut += amount;
      }

      if (tx.balanceEffectType === "Withdrawal") {
        totalIn += amount;
      }
    }

    // ─────────────────────────────
    // ACTIVITY (NON-CASH ONLY)
    // ─────────────────────────────
    if (tx.entryType !== "payment") {
      totalActivity += amount;
    }

    // ─────────────────────────────
    // BREAKDOWN COUNTERS
    // ─────────────────────────────
    if (tx.entryType === "invoice") invoices += amount;
    if (tx.entryType === "expense") expenses += amount;
    if (tx.entryType === "fx_adjustment") fxAdjustments += amount;
    if (tx.entryType === "opening_balance") openingBalances += amount;

    return {
      ...tx,
      runningBalance,
      balanceEffect: effect,
      partyType: role,
    };
  });

  const sortedTransactions = [...transactionsWithBalance].sort(sortDesc);
  const paginatedTransactions = sortedTransactions.slice(skip, skip + pageSize);

  res.status(200).json({
    status: "true",
    pages: Math.ceil(transactionsWithBalance.length / pageSize),
    results: paginatedTransactions.length,
    data: paginatedTransactions,

    summary: {
      runningBalance,

      cash: {
        totalIn,
        totalOut,
      },

      activity: {
        invoices,
        payments,
        expenses,
        fxAdjustments,
        openingBalances,
      },

      totals: {
        totalActivity,
      },
    },
  });
};
module.exports = {
  getPaymentHistory,
};

module.exports = {
  createPaymentHistory,
  getPaymentHistory,
  createPaymentHistoryV2,
};
