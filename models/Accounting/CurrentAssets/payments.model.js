const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema(
  {
    source: {
      id: String,
      name: String,
    },
    sourceType: {
      type: String,
      enum: ["supplier", "customer", "fund", "account"],
      required: true,
    },

    destination: {
      id: String,
      name: String,
    },
    destinationType: {
      type: String,
      enum: ["supplier", "customer", "fund", "account"],
      required: true,
    },

    paymentCurrency: {
      id: String,
      code: String,
      name: String,
      exchangeRate: Number,
    },

    sourceCurrency: {
      id: String,
      code: String,
      name: String,
      exchangeRate: Number,
    },

    destinationCurrency: {
      id: String,
      code: String,
      name: String,
      exchangeRate: Number,
    },

    amountInPaymentCurrency: {
      type: Number,
      default: 0,
    },

    amountInMainCurrency: {
      type: Number,
      default: 0,
    },

    amountInSourceCurrency: {
      type: Number,
      default: 0,
    },

    amountInDestinationCurrency: {
      type: Number,
      default: 0,
    },

    allocations: [
      {
        refId: String,
        refType: {
          type: String,
          enum: [
            "purchase_invoice",
            "sales_invoice",
            "opening_balance",
            "advance",
            "refund",
            "other",
          ],
        },
        refName: String,

        documentCurrencyCode: String,
        documentExchangeRate: Number,
        paymentExchangeRate: Number,

        documentTotal: Number,
        documentRemainingBefore: Number,
        documentRemainingAfter: Number,

        appliedAmountInDocumentCurrency: Number,
        appliedAmountInPaymentCurrency: Number,
        appliedAmountInMainCurrency: Number,

        fxDifference: {
          type: Number,
          default: 0,
        },
        fxType: {
          type: String,
          enum: ["gain", "loss", null],
          default: null,
        },

        _id: false,
      },
    ],

    unallocatedAmountInPaymentCurrency: {
      type: Number,
      default: 0,
    },

    unallocatedAmountInMainCurrency: {
      type: Number,
      default: 0,
    },

    paymentType: {
      type: String,
      enum: ["inflow", "outflow", "transfer"],
      required: true,
    },

    journalCounter: String,
    description: String,
    date: String,
    file: String,

    status: {
      type: String,
      enum: ["draft", "posted", "cancelled"],
      default: "posted",
      index: true,
    },

    postedBy: {
      type: mongoose.Schema.ObjectId,
      ref: "Employee",
      default: null,
    },
    postedAt: {
      type: Date,
      default: null,
    },

    cancelledBy: {
      type: mongoose.Schema.ObjectId,
      ref: "Employee",
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancellationReason: {
      type: String,
      default: "",
    },

    counter: {
      type: String,
      default: "0",
    },

    audited: {
      type: Boolean,
      default: false,
    },

    sync: {
      type: Boolean,
      default: false,
    },

    companyId: {
      type: String,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

PaymentSchema.index({ counter: 1, companyId: 1 }, { unique: true });

module.exports = mongoose.model("Payments", PaymentSchema);
