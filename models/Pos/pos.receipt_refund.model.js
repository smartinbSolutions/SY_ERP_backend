const mongoose = require("mongoose");

// ── Reusable sub-schemas ──────────────────────────────────────────────────────

const cartItemFields = {
  type: { type: String, default: "product" },
  id: String,
  qr: String,
  name: String,
  category: String,
  orginalBuyingPrice: Number,
  profitRatio: Number,
  convertedBuyingPrice: Number,
  buyingpriceMainCurrence: Number,
  sellingPrice: Number,
  unit: String,
  tax: {
    _id: String,
    tax: Number,
    salesAccountTax: String,
    name: String,
  },
  taxValue: Number,
  soldQuantity: Number,
  totalWithoutTax: Number,
  total: Number,
  exchangeRate: Number,
  discountType: String,
  discountPercentege: Number,
  discountAmount: Number,
  discount: Number,
  note: String,
  showNote: Boolean,
  showDiscount: Boolean,
  batches: [{ id: String, quantity: Number, _id: false }],
  _id: false,
};

// ── Schema ────────────────────────────────────────────────────────────────────

const receiptRefundSchema = new mongoose.Schema(
  {
    // ── Identity
    invoiceName: String,
    counter: { type: String, default: 0 },
    date: String,
    description: String,
    employee: String,
    companyId: { type: String, required: true, index: true },
    salesPoint: { type: mongoose.Schema.ObjectId, ref: "salesPoints" },
    stock: { type: mongoose.Schema.ObjectId, ref: "Stock" },

    // ── Receipt reference
    receipt: { type: mongoose.Schema.ObjectId, ref: "receipt" },
    receiptCounter: { type: String },

    // ── Customer
    customer: {
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
      _id: false,
    },

    // ── Currency
    currency: {
      id: String,
      currencyCode: String,
      currencyName: String,
      exchangeRate: String,
      _id: false,
    },
    exchangeRate: Number,

    // ── Cart
    cartItems: [cartItemFields],

    // ── Totals
    invoiceSubTotal: Number,
    invoiceGrandTotal: Number,
    invoiceTax: Number,
    totalInMainCurrency: Number,
    paymentInFundCurrency: Number,

    // ── Discounts
    manuallInvoiceDiscount: Number,
    manuallInvoiceDiscountValue: Number,
    invoiceDiscount: Number,
    ManualInvoiceDiscountValue: Number,
    InvoiceDiscountType: String,

    // ── Tax summary
    taxSummary: [
      {
        taxId: String,
        taxRate: Number,
        totalTaxValue: Number,
        discountTaxValue: Number,
        salesAccountTax: String,
        _id: false,
      },
    ],

    // ── Payment
    financialFund: [
      {
        currency: String,
        currencyCode: String,
        currencyID: String,
        exchangeRate: String,
        fundName: String,
        fundId: String,
        allocatedAmount: Number,
        accountId: String,
        _id: false,
      },
    ],
    paymentsStatus: { type: String, default: "paid" },

    // ── Misc
    journalized: { type: Boolean, default: false },
    journalizedAt: { type: Date, default: null },
    journalRef: {
      type: mongoose.Schema.ObjectId,
      ref: "JournalEntry",
      default: null,
    },
    tags: [{ id: String, name: String, _id: false }],
    sync: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("receipt_refund", receiptRefundSchema);

// const mongoose = require("mongoose");

// const receiptRefundSchema = new mongoose.Schema(
//   {
//     employee: String,
//     financialFund: [
//       {
//         currency: String,
//         currencyCode: String,
//         currencyID: String,
//         exchangeRate: String,
//         fundName: String,
//         fundId: String,
//         allocatedAmount: Number,
//         accountId: String,
//         _id: false,
//       },
//     ],

//     cartItems: [
//       {
//         type: { type: String, default: "product" },
//         id: String,
//         qr: String,
//         name: String,
//         category: String,
//         orginalBuyingPrice: Number,
//         profitRatio: Number,
//         convertedBuyingPrice: Number,
//         sellingPrice: Number,
//         unit: String,
//         tax: {
//           _id: String,
//           tax: Number,
//           salesAccountTax: String,
//           name: String,
//         },
//         taxValue: Number,
//         soldQuantity: Number,
//         totalWithoutTax: Number,
//         total: Number,
//         note: String,
//         exchangeRate: Number,
//         discountType: String,
//         discountPercentege: Number,
//         discountAmount: Number,
//         discount: Number,
//         showNote: Boolean,
//         showDiscount: Boolean,
//         buyingpriceMainCurrence: Number,
//         batches: [{ id: String, quantity: Number, _id: false }],
//         _id: false,
//       },
//     ],

//     customer: {
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
//       _id: false,
//     },
//     taxSummary: [
//       {
//         taxId: String,
//         taxRate: Number,
//         totalTaxValue: Number,
//         discountTaxValue: Number,
//         salesAccountTax: String,
//         _id: false,
//       },
//     ],
//     currency: {
//       id: String,
//       currencyCode: String,
//       currencyName: String,
//       exchangeRate: String,
//       _id: false,
//     },
//     paymentsStatus: { type: String, default: "paid" },
//     exchangeRate: Number,
//     invoiceName: String,
//     totalInMainCurrency: Number,
//     manuallInvoiceDiscount: Number,
//     manuallInvoiceDiscountValue: Number,
//     invoiceDiscount: Number,
//     ManualInvoiceDiscountValue: Number,
//     paymentInFundCurrency: Number,
//     invoiceGrandTotal: Number,
//     InvoiceDiscountType: String,
//     invoiceSubTotal: Number,
//     invoiceTax: Number,
//     date: String,
//     description: String,
//     salesPoint: { type: mongoose.Schema.ObjectId, ref: "salesPoints" },
//     counter: {
//       type: String,
//       default: 0,
//     },
//     receipt: { type: mongoose.Schema.ObjectId, ref: "receipt" },
//     receiptCounter: { type: String },
//     stock: { type: mongoose.Schema.ObjectId, ref: "Stock" },
//     sync: { type: Boolean, default: false },
//     companyId: {
//       type: String,
//       required: true,
//       index: true,
//     },
//     journalized: { type: Boolean, default: false },
//     journalizedAt: { type: Date, default: null },
//     journalRef: {
//       type: mongoose.Schema.ObjectId,
//       ref: "JournalEntry",
//       default: null,
//     },
//   },

//   { timestamps: true }
// );

// module.exports = mongoose.model("receipt_refund", receiptRefundSchema);
