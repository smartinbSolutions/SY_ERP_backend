const mongoose = require("mongoose");

const ProductBatchSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.ObjectId,
      ref: "product",
      required: true,
      index: true,
    },

    companyId: {
      type: String,
      required: true,
      index: true,
    },

    stockId: { type: mongoose.Schema.ObjectId, ref: "Stock" },

    quantity: {
      type: Number,
    },

    remaining: {
      type: Number,
    },

    buyingprice: {
      type: Number,
    },
    costBuyingPrice: Number,
    exchangeRate: { type: Number, default: 1 },
    sourceType: {
      type: String,
      default: "purchase",
    },

    sourceId: {
      type: mongoose.Schema.ObjectId,
      default: null,
    },
    batchDate: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

ProductBatchSchema.index(
  { productId: 1, companyId: 1, stockId: 1, batchDate: 1 },
  { name: "fifo_index" }
);
module.exports = mongoose.model(" ProductBatch", ProductBatchSchema);
