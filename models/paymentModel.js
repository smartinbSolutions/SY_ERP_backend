const mongoose = require("mongoose");

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

    source: {
      id: String,
      name: String,
      type: String,
      amount: {
        type: Number,
        default: 0,
      },
      currencyCode: String,
      exchangeRate: {
        type: Number,
        default: 1,
      },
    },

    destination: {
      id: String,
      name: String,
      type: String,
      amount: {
        type: Number,
        default: 0,
      },
      currencyCode: String,
      exchangeRate: {
        type: Number,
        default: 1,
      },
    },

    totalMainCurrency: {
      type: Number,
      default: 0,
    },

    paymentNature: {
      type: String,
      enum: ["incoming", "outgoing", "transfer"],
      required: true,
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
        documentType: String,
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

    auditing: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

PaymentSchema.index({ counter: 1, companyId: 1 }, { unique: true });

module.exports = mongoose.model("Payments", PaymentSchema);

// const mongoose = require("mongoose");

// const PaymentSchema = new mongoose.Schema(
//   {
//     source: { name: String, id: String },
//     destination: { name: String, id: String },
//     sourceType: String,
//     destinationType: String,
//     totalInPaymentCurrency: {
//       type: Number,
//       require: true,
//       default: 0,
//     },
//     totalMainCurrency: {
//       type: Number,
//       default: 0,
//     },
//     paymentInDestinationCurrency: String,
//     destinationExchangeRate: {
//       type: Number,
//       default: 1,
//     },
//     destinationCurrencyCode: String,
//     paymentCurrency: {
//       name: String,
//       code: String,
//       id: String,
//       exchangeRate: String,
//     },

//     ref: String,

//     financailType: String,
//     type: String,
//     paymentType: String,

//     date: String,
//     description: String,
//     journalCounter: String,
//     file: String,
//     sync: { type: Boolean, default: false },
//     companyId: {
//       type: String,
//       required: true,
//       index: true,
//     },
//     payid: [
//       {
//         id: String,
//         status: String,
//         paymentInFundCurrency: Number,
//         paymentMainCurrency: Number,
//         paymentInvoiceCurrency: Number,
//         invoiceTotal: String,
//         invoiceName: String,
//         invoiceCurrencyCode: String,
//         invoiceType: String,
//         _id: false,
//       },
//     ],
//     counter: {
//       type: String,
//       default: 0,
//     },
//     auditing: { type: Boolean, default: false },
//   },
//   { timestamps: true }
// );
// PaymentSchema.index({ counter: 1, companyId: 1 }, { unique: true });

// module.exports = mongoose.model("Payments", PaymentSchema);
