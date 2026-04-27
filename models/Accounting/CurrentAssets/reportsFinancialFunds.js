const mongoose = require("mongoose");

const reportsFinancialFundsSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },
    totalPriceMainCurrence: {
      type: Number,
    },
    ref: String,
    type: {
      type: String,
      enum: [
        "Deposit transfer",
        "Withdrawal transfer",
        "Deposit",
        "Withdrawal",
      ],
    },
    paymentType: { type: String, enum: ["Withdrawal", "Deposit"] },
    financialFundId: {
      type: mongoose.Schema.ObjectId,
      ref: "FinancialFunds",
    },
    payment: String,
    exchangeRate: Number,
    description: String,
    sync: { type: Boolean, default: false },
    companyId: {
      type: String,
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model(
  "ReportsFinancialFunds",
  reportsFinancialFundsSchema,
);
