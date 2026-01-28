const mongoose = require("mongoose");

const reconciliationItemSchema = new mongoose.Schema(
  {
    reconciliationId: {
      type: mongoose.Schema.ObjectId,
      ref: "Reconciliation",
      required: true,
      index: true,
    },

    productId: {
      type: mongoose.Schema.ObjectId,
      ref: "product",
      required: true,
    },
    companyId: { type: String, required: true, index: true },
    productBarcode: { type: String, index: true },
    productName: { type: String },

    recordCount: { type: Number, default: 0 },
    realCount: { type: Number, default: 0 },
    difference: { type: Number, default: 0 },

    reconcilingReason: { type: String },

    reconciled: { type: Boolean, default: false },

    priceSnapshot: {
      buyingPrice: Number,
      sellingPrice: Number,
      oldSellingPrice: Number,
      exchangeRate: Number,
      currencyCode: String,
      profitRatio: Number,
    },

    createdBy: { type: String },
  },
  { timestamps: true }
);

reconciliationItemSchema.index(
  { reconciliationId: 1, productId: 1 },
  { unique: true }
);

module.exports = mongoose.model("ReconciliationItem", reconciliationItemSchema);
