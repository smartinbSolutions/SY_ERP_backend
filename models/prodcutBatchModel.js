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
      type: mongoose.Schema.ObjectId,
      ref: "Stock",
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

    costBuyingPrice: {
      type: Number,
    },

    exchangeRate: {
      type: Number,
      default: 1,
    },

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
      index: true,
    },

    status: {
      type: String,
      enum: ["active", "reversed"],
      default: "active",
      index: true,
    },

    reversedAt: {
      type: Date,
      default: null,
    },

    reversedBy: {
      type: mongoose.Schema.ObjectId,
      ref: "Employee",
      default: null,
    },

    reverseReason: {
      type: String,
      default: "",
    },

    reverseSourceId: {
      type: mongoose.Schema.ObjectId,
      default: null,
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

module.exports = mongoose.model("ProductBatch", ProductBatchSchema);
