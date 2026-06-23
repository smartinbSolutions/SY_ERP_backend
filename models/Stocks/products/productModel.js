const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    /* =========================
       BASIC INFORMATION
    ========================== */
    name: {
      type: String,
      require: true,
    },
    latinName: String,
    slug: {
      type: String,
      lowercase: true,
    },
    type: {
      type: String,
      enum: ["Normal", "Service", "rawmaterial", "manufactured"],
      default: "Normal",
    },
    description: {
      type: String,
      default: "Product description",
    },
    image: String,
    originalProductId: String,
    /* =========================
       PRICING & QUANTITY
    ========================== */
    price: { type: Number, default: 0 },
    buyingprice: { type: Number, default: 0 },
    costBuyingPrice: { type: Number, default: 0 },
    profitRatio: { type: Number, default: 5 },
    haveCost: { type: Boolean, default: true },

    /* =========================
       IDENTIFIERS
    ========================== */
    sku: {
      type: String,
      default: 0,
    },
    qr: [
      {
        type: String,
        minlength: [3, "Too short QR code"],
        maxlength: [30, "Too long QR code"],
        index: true,
        require: true,
      },
    ],
    counter: String,

    /* =========================
       RELATIONS
    ========================== */
    brand: {
      type: mongoose.Schema.ObjectId,
      ref: "brand",
    },
    category: {
      type: mongoose.Schema.ObjectId,
      ref: "Category",
    },
    unit: {
      type: mongoose.Schema.ObjectId,
      ref: "Unit",
    },
    tax: {
      type: mongoose.Schema.ObjectId,
      ref: "Tax",
    },
    currency: {
      type: mongoose.Schema.ObjectId,
      ref: "Currency",
    },
    mostLiklySupplier: {
      type: mongoose.Schema.ObjectId,
      ref: "Supplier",
      default: null,
    },

    /* =========================
       STOCK & ALERTS
    ========================== */
    alarm: { type: Number, default: 0 },
    stocks: [
      {
        stockId: String,
        stockName: String,
        productQuantity: Number,
        minimum: String,
        maximum: String,
        _id: false,
      },
    ],

    /* =========================
       UNIT PRICES
    ========================== */
    unitsPrices: [
      {
        name: String,
        equal: String,
        unitId: {
          type: mongoose.Schema.ObjectId,
          ref: "Unit",
        },
        prices: [
          {
            title: String,
            price: Number,
            _id: false,
          },
        ],
        _id: false,
      },
    ],

    /* =========================
       VARIANTS
    ========================== */
    variantName: [{ name: String, values: [String] }],
    variants: [
      {
        name: String,
        qr: String,
        buyingprice: Number,
        price: Number,
        taxValue: { type: Number, default: 0 },
        priceTax: { type: Number, default: 0 },
        profitRatio: { type: Number, default: 0 },
        available: { type: Boolean, default: true },
        stocks: [
          {
            stockId: String,
            stockName: String,
            quantity: { type: Number, default: 0 },
            _id: false,
          },
        ],
        _id: false,
      },
    ],

    /* =========================
       ADDITIONAL DATA
    ========================== */
    AdditionalInfo: {
      type: String,
      default: "Additional Info",
    },
    customAttributes: [
      {
        key: String,
        value: String,
        _id: false,
      },
    ],
    serialNumbers: [{ type: String, default: "" }],
    expirationDate: { type: String, default: Date.now },

    /* =========================
       SYSTEM FIELDS
    ========================== */
    archives: {
      type: Boolean,
      default: false,
    },
    sync: { type: Boolean, default: false },
    companyId: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

/* =========================
   INDEXES
========================== */
productSchema.index({ counter: 1, companyId: 1 }, { unique: true });

module.exports = mongoose.model("product", productSchema);
