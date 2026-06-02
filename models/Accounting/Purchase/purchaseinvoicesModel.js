const mongoose = require("mongoose");

const PurchaseInvoicesSchema = new mongoose.Schema(
  {
    supllier: {
      id: String,
      name: String,
      supplierCompany: String,
      supplierEmail: String,
      phoneNumber: String,
      address: String,
    },

    archives: { type: Boolean, default: false },

    type: {
      type: String,
      default: "normal",
    },

    status: {
      type: String,
      enum: ["draft", "posted", "cancelled"],
      default: "draft",
      index: true,
    },

    invoicesItems: [
      {
        id: String,
        type: { type: String },
        qr: { type: String },
        name: { type: String },
        orginalBuyingPrice: { type: Number },
        tax: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Tax",
        },
        unit: String,
        stock: {
          _id: { type: mongoose.Schema.Types.ObjectId },
          stock: { type: String },
        },
        note: String,
        exchangeRate: { type: Number },
        quantity: { type: Number },
        discountType: { type: String },
        discountPercentege: { type: Number },
        discountAmount: { type: Number },
        discount: { type: Number },
        convertedBuyingPrice: { type: Number },
        draftCostBuyingPrice: { type: Number },
        totalWithoutTax: { type: Number },
        total: { type: Number },
        taxValue: { type: Number },
        profitRatio: { type: Number },
        showNote: Boolean,
        showDiscount: Boolean,
        vName: String,
        _id: false,
      },
    ],

    exchangeRate: Number,

    currency: {
      currencyCode: String,
      exchangeRate: Number,
      id: String,
      currencyName: String,
    },

    invoiceGrandTotal: Number,
    invoiceSubTotal: Number,
    invoiceDiscount: Number,
    ManualInvoiceDiscount: Number,
    ManualInvoiceDiscountValue: Number,
    invoiceTax: Number,

    taxDetails: [
      {
        taxRate: Number,
        totalTaxValue: Number,
        discountTaxValue: Number,
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

    invoiceName: String,
    invoiceNumber: String,
    invoiceType: { type: String, default: "Purchase" },

    financailFund: { value: String, label: String },
    paymentInFundCurrency: String,

    totalPurchasePrice: Number,
    totalPurchasePriceMainCurrency: Number,

    date: String,
    dueDate: String,
    paymentDate: String,
    description: String,
    receiptNumber: String,

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

    counter: String,
    InvoiceDiscountType: String,

    paid: {
      type: String,
      default: "unpaid",
      enum: ["paid", "unpaid"],
    },

    employee: {
      type: mongoose.Schema.ObjectId,
      ref: "user",
    },

    postedBy: {
      type: mongoose.Schema.ObjectId,
      ref: "user",
      default: null,
    },
    postedAt: {
      type: Date,
      default: null,
    },

    cancelledBy: {
      type: mongoose.Schema.ObjectId,
      ref: "user",
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

    openingBalanceId: String,
    reportsBalanceId: String,
    file: String,
    journalCounter: String,

    isDraft: { type: Boolean, default: false, index: true },

    draftJournalSnapshot: {
      journalMeta: { type: mongoose.Schema.Types.Mixed, default: null },
      journalAccounts: { type: [mongoose.Schema.Types.Mixed], default: [] },
      totals: {
        totalDebit: { type: Number, default: 0 },
        totalCredit: { type: Number, default: 0 },
        balanced: { type: Boolean, default: false },
        _id: false,
      },
      generatedAt: { type: Date, default: null },
      source: { type: String, default: "frontend" },
      _id: false,
    },

    sync: { type: Boolean, default: false },

    companyId: {
      type: String,
      required: true,
      index: true,
    },

    auditing: { type: Boolean, default: false },
  },
  { timestamps: true },
);

module.exports = mongoose.model("PurchaseInvoices", PurchaseInvoicesSchema);
