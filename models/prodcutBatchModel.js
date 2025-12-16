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

    stockId: {
      type: String,
    },

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
    sourceType: {
      type: String,
      default: "purchase",
    },

    sourceId: {
      type: mongoose.Schema.ObjectId,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

ProductBatchSchema.index(
  { productId: 1, companyId: 1, stockId: 1, createdAt: 1 },
  { name: "fifo_index" }
);

module.exports = mongoose.model(" ProductBatch", ProductBatchSchema);
