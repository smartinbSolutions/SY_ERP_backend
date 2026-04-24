const mongoose = require("mongoose");

const PARTY_TYPES = ["supplier", "customer", "employee"];
const DOCUMENT_TYPES = [
  "purchase_invoice",
  "sales_invoice",
  "opening_balance",
  "advance",
  "refund",
  "other",
];

const PaymentSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: true,
      index: true,
    },

    counter: {
      type: String,
      default: "0",
    },

    party: {
      id: String,
      name: String,
      type: {
        type: String,
        enum: PARTY_TYPES,
      },
    },

    fund: {
      id: String,
      name: String,
      currencyId: String,
      currencyCode: String,
      exchangeRate: {
        type: Number,
        default: 1,
      },
    },

    paymentNature: {
      type: String,
      enum: ["incoming", "outgoing", "transfer"],
      required: true,
    },

    payment: {
      amount: {
        type: Number,
        default: 0,
      },
      currencyId: String,
      currencyCode: String,
      exchangeRate: {
        type: Number,
        default: 1,
      },
      amountMainCurrency: {
        type: Number,
        default: 0,
      },
    },

    date: Date,

    description: {
      type: String,
      default: "",
    },

    journalCounter: {
      type: String,
      default: "",
    },

    file: {
      type: String,
      default: "",
    },

    sync: {
      type: Boolean,
      default: false,
    },

    allocations: [
      {
        documentId: String,
        documentType: {
          type: String,
          enum: DOCUMENT_TYPES,
        },
        documentName: String,
        documentCounter: String,
        documentCurrencyCode: String,

        allocatedAmountMainCurrency: {
          type: Number,
          default: 0,
        },

        allocatedAmountDocumentCurrency: {
          type: Number,
          default: 0,
        },

        documentTotal: {
          type: Number,
          default: 0,
        },

        _id: false,
      },
    ],

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

    auditing: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

PaymentSchema.index({ counter: 1, companyId: 1 }, { unique: true });

module.exports = mongoose.model("Payment", PaymentSchema);
