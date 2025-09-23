const mongoose = require("mongoose");

const batchSchema = new mongoose.Schema(
  {
    rawMaterialId: {
      type: mongoose.Schema.ObjectId,
      ref: "RawMaterial",
    },
    stockId: {
      type: mongoose.Schema.ObjectId,
      ref: "Stock",
    },
    quantity: {
      type: Number,
    },
    currency: {
      type: mongoose.Schema.ObjectId,
      ref: "Currency",
    },

    tax: {
      type: mongoose.Schema.ObjectId,
      ref: "Tax",
    },
    leftQuantity: {
      type: Number,
    },
    buyingPrice: {
      type: Number,
    },
    overallCost: {
      type: Number,
      default: 0,
    },
    expirationDate: {
      type: String,
    },
    purchaseDate: {
      type: String,
      default: Date.now,
    },
    sync: { type: Boolean, default: false },
    companyId: {
      type: String,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Batch", batchSchema);
