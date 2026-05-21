const mongoose = require("mongoose");

const reportsFinancialFundsSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    // ── Which way (THE ONLY FIELD THAT DRIVES MATH) ─────────────────
    direction: {
      type: String,
      enum: ["in", "out"],
      required: true,
    },

    // ── What operation produced this row (descriptive, not math) ────
    source: {
      type: String,
      required: true,
      enum: [
        "opening_balance",
        "sale",
        "purchase",
        "expense",
        "salary",
        "transfer",
        "refund_sale",
        "refund_purchase",
        "cancel_sale",
        "cancel_purchase",
        "cancel_expense",
        "cancel_transfer",
        "cancel_salary",
        "manual_adjustment",
        "payment",
        // add as new flows are built
      ],
    },

    // ── Back-reference to the originating document ──────────────────
    refType: {
      type: String,
      required: true,
      enum: [
        "invoice",
        "refund_invoice",
        "expense",
        "salary",
        "transfer",
        "payment",
        "manual",
      ],
    },
    refId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    // ── Link to the payment record (optional) ───────────────────────
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      index: true,
    },

    // ── Which fund this row belongs to ──────────────────────────────
    financialFundId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "financialFunds",
      required: true,
      index: true,
    },

    // ── Snapshot of fund balance after this row (helper, not truth) ─

    financialFundRest: {
      type: Number,
    },

    // ── Free-form description ───────────────────────────────────────
    description: {
      type: String,
      default: "",
    },

    // ── Audit ───────────────────────────────────────────────────────
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // ── Tenancy ─────────────────────────────────────────────────────
    companyId: {
      type: String,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

reportsFinancialFundsSchema.index({
  companyId: 1,
  financialFundId: 1,
  date: 1,
});

reportsFinancialFundsSchema.index({ refType: 1, refId: 1 });

module.exports = mongoose.model(
  "ReportsFinancialFunds",
  reportsFinancialFundsSchema
);
