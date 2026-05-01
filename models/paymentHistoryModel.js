const mongoose = require("mongoose");

const PaymentHistorySchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: true,
      index: true,
    },

    transactionDate: {
      type: String,
    },

    paymentId: {
      type: String,
    },

    customerId: {
      type: String,
    },

    supplierId: {
      type: String,
    },

    entryType: {
      type: String,
      enum: [
        "payment",
        "invoice",
        "expense",
        "opening_balance",
        "fx_adjustment",
      ],
    }, // what kind of history row this is

    balanceEffectType: {
      type: String,
      enum: ["Deposit", "Withdrawal"],
    }, // effect on supplier/customer balance

    amountTransactionCurrency: {
      type: Number,
    }, // amount in transaction currency

    amountMainCurrency: {
      type: Number,
    }, // amount in company main currency

    referenceId: {
      type: String,
    }, // related document id

    sourceModule: {
      type: String,
      enum: ["payment", "purchase", "sales", "expense", "opening_balance"],
    }, // which module created this history row

    actionType: {
      type: String,
      enum: ["create", "cancel", "refund", "update"],
    }, // what happened

    transactionCurrency: {
      type: String,
    },

    description: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PaymentHistory", PaymentHistorySchema);
