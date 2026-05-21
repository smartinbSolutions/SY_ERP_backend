const mongoose = require("mongoose");

const returnPurchaseInvicesSchema = new mongoose.Schema(
  {
    supplier: {
      id: String,
      name: String,
      phone: String,
      email: String,
      address: String,
      company: String,
      taxAdministration: String,
      taxNumber: String,
      country: String,
      city: String,
      linkAccount: String,
    },

    type: { type: String, default: "refund purchase" },

    sourcePurchaseInvoices: [
      {
        invoiceId: { type: mongoose.Schema.Types.ObjectId },
        invoiceNumber: { type: String },
        invoiceName: { type: String },
        invoiceDate: { type: String },
        _id: false,
      },
    ],

    invoicesItems: [
      {
        type: { type: String },
        qr: { type: String },
        name: { type: String },
        orginalBuyingPrice: { type: Number },

        tax: {
          _id: { type: mongoose.Schema.Types.ObjectId },
          tax: { type: Number },
          name: { type: String },
        },

        stock: {
          _id: { type: mongoose.Schema.Types.ObjectId },
          stock: { type: String },
        },

        exchangeRate: { type: Number },
        discountType: { type: String },
        discountPercentege: { type: Number },
        discountAmount: { type: Number },
        discount: { type: Number },
        convertedBuyingPrice: { type: Number },
        totalWithoutTax: { type: Number },
        total: { type: Number },
        taxValue: { type: Number },
        profitRatio: { type: Number },
        showNote: Boolean,
        showDiscount: Boolean,
        unit: String,

        sourceInvoiceId: { type: mongoose.Schema.Types.ObjectId },
        sourceInvoiceNumber: { type: String },
        sourceInvoiceName: { type: String },
        sourceInvoiceDate: { type: String },
        sourceInvoiceItemIndex: { type: Number },

        refundedQuantity: { type: Number, default: 0 },
        remainingQuantityBeforeRefund: { type: Number, default: 0 },
        remainingQuantityAfterRefund: { type: Number, default: 0 },

        selectedBatchId: { type: mongoose.Schema.Types.ObjectId },
        selectedBatchStockId: { type: mongoose.Schema.Types.ObjectId },
        selectedBatchDate: { type: Date },
        selectedBatchRemainingAtRefund: { type: Number, default: 0 },

        _id: false,
      },
    ],

    exchangeRate: Number,

    currency: {
      currencyCode: String,
      currencyName: String,
      currencyId: String,
      exchangeRate: Number,
      _id: String,
    },

    invoiceGrandTotal: Number,
    invoiceSubTotal: Number,
    invoiceDiscount: Number,
    ManualInvoiceDiscount: Number,
    invoiceTax: Number,

    taxDetails: [
      {
        taxRate: Number,
        totalTaxValue: Number,
        discountTaxValue: Number,
        _id: false,
      },
    ],

    invoiceName: String,

    financailFund: {
      value: String,
      label: String,
    },

    paymentInFundCurrency: String,
    totalPurchasePrice: Number,
    totalPurchasePriceMainCurrency: Number,

    date: String,
    description: String,
    invoiceType: String,

    totalRemainderMainCurrency: { type: Number, default: 0 },
    totalRemainder: { type: Number, default: 0 },

    payments: [
      {
        payment: Number,
        paymentMainCurrency: Number,
        financialFunds: String,
        financialFundsId: String,
        financialFundsCurrencyCode: String,
        exchangeRate: String,
        date: String,
        paymentID: String,
        paymentInInvoiceCurrency: Number,
        fxDiff: {
          type: Number,
          default: 0,
        },
        invoiceRate: {
          type: Number,
          default: 1,
        },
        paymentRate: {
          type: Number,
          default: 1,
        },
        _id: false,
      },
    ],

    tag: [
      {
        id: String,
        name: String,
        color: String,
        _id: false,
      },
    ],

    InvoiceDiscountType: String,

    paid: {
      type: String,
      default: "unpaid",
    },

    employee: {
      type: mongoose.Schema.ObjectId,
      ref: "Employee",
    },

    invoiceNumber: {
      type: String,
    },

    openingBalanceId: String,
    reportsBalanceId: String,
    journalCounter: String,
    counter: String,
    sync: { type: Boolean, default: false },

    companyId: {
      type: String,
      required: true,
      index: true,
    },

    auditing: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "refundpurchaseinvoices",
  returnPurchaseInvicesSchema
);

// const mongoose = require("mongoose");

// const returnPurchaseInvicesSchema = new mongoose.Schema(
//   {
//     supplier: {
//       id: String,
//       name: String,
//       phone: String,
//       email: String,
//       address: String,
//       company: String,
//       taxAdministration: String,
//       taxNumber: String,
//       country: String,
//       city: String,
//       linkAccount: String,
//     },
//     type: { type: String, default: "refund purchase" },
//     invoicesItems: [
//       {
//         type: { type: String },
//         qr: { type: String },
//         name: { type: String },
//         orginalBuyingPrice: { type: Number },
//         tax: {
//           _id: { type: mongoose.Schema.Types.ObjectId },
//           tax: { type: Number },
//         },
//         stock: {
//           _id: { type: mongoose.Schema.Types.ObjectId },
//           stock: { type: String },
//         },
//         exchangeRate: { type: Number },
//         quantity: { type: Number },
//         discountType: { type: String },
//         discountPercentege: { type: Number },
//         discountAmount: { type: Number },
//         discount: { type: Number },
//         convertedBuyingPrice: { type: Number },
//         totalWithoutTax: { type: Number },
//         total: { type: Number },
//         taxValue: { type: Number },
//         profitRatio: { type: Number },
//         showNote: Boolean,
//         showDiscount: Boolean,
//         unit: String,

//         _id: false,
//       },
//     ],
//     exchangeRate: Number,
//     currency: {
//       currencyCode: String,
//       currencyName: String,
//       currencyId: String,
//       exchangeRate: Number,
//       _id: String,
//     },
//     invoiceGrandTotal: Number,
//     invoiceSubTotal: Number,
//     invoiceDiscount: Number,
//     ManualInvoiceDiscount: Number,
//     invoiceTax: Number,
//     taxDetails: [
//       {
//         taxRate: Number,
//         totalTaxValue: Number,
//         discountTaxValue: Number,
//         _id: false,
//       },
//     ],
//     invoiceName: String,

//     financailFund: { value: String, label: String },
//     paymentInFundCurrency: String,
//     totalPurchasePrice: Number,
//     totalPurchasePriceMainCurrency: Number,

//     date: String,
//     description: String,
//     invoiceType: String,
//     totalRemainderMainCurrency: { type: Number, default: 0 },
//     totalRemainder: { type: Number, default: 0 },
//     payments: [
//       {
//         payment: Number,
//         paymentMainCurrency: Number,
//         financialFunds: String,
//         financialFundsId: String,
//         financialFundsCurrencyCode: String,
//         exchangeRate: String,
//         date: String,
//         paymentID: String,
//         paymentInInvoiceCurrency: Number,
//         _id: false,
//       },
//     ],
//     tag: [
//       {
//         id: String,
//         name: String,
//         color: String,
//         _id: false,
//       },
//     ],
//     InvoiceDiscountType: String,
//     paid: {
//       type: String,
//       default: "unpaid",
//     },
//     employee: {
//       type: mongoose.Schema.ObjectId,
//       ref: "Employee",
//     },
//     invoiceNumber: {
//       type: String,
//     },

//     openingBalanceId: String,
//     reportsBalanceId: String,
//     journalCounter: String,
//     counter: String,
//     sync: { type: Boolean, default: false },
//     companyId: {
//       type: String,
//       required: true,
//       index: true,
//     },
//     auditing: { type: Boolean, default: false },
//   },

//   { timestamps: true }
// );

// module.exports = mongoose.model(
//   "refundpurchaseinvoices",
//   returnPurchaseInvicesSchema
// );
