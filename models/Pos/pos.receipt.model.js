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

const receiptSchema = new mongoose.Schema(
  {
    // ── Identity
    invoiceName: String,
    status: {
      type: String,
      enum: ["active", "cancelled", "partially_refunded", "fully_refunded"],
      default: "active",
    },
    counter: { type: String, default: 0 },
    date: String,
    description: String,
    employee: String,
    companyId: { type: String, required: true, index: true },
    salesPoint: { type: mongoose.Schema.ObjectId, ref: "salesPoints" },
    stock: { type: mongoose.Schema.ObjectId, ref: "Stock" },

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
      _id: String,
      currencyCode: String,
      currencyName: String,
      exchangeRate: String,
    },
    exchangeRate: Number,

    // ── Cart
    cartItems: [cartItemFields],
    returnCartItem: [cartItemFields],

    // ── Totals
    invoiceSubTotal: Number,
    invoiceGrandTotal: Number,
    invoiceTax: Number,
    totalInMainCurrency: Number,
    paymentInFundCurrency: Number,
    change: { type: Number, default: 0 },

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
        currencyID: String,
        exchangeRate: String,
        currencyCode: String,
        fundName: String,
        fundId: String,
        accountId: String,
        allocatedAmount: Number,
        change: { type: Number, default: 0 },
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

module.exports = mongoose.model("receipt", receiptSchema);
