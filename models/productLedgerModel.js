// models/inventoryLedgerModel.js
const mongoose = require("mongoose");

const productLedgerSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.ObjectId,
      ref: "product",
      required: true,
    },

    companyId: {
      type: String,
      required: true,
      index: true,
    },

    stockId: { type: mongoose.Schema.ObjectId, ref: "Stock" },

    type: {
      type: String,
      enum: ["in", "out"],
      required: true,
    },

    quantity: Number,
    cost: Number,
    costBuyingPrice: Number,
    batchId: {
      type: mongoose.Schema.ObjectId,
      ref: "ProductBatch",
    },

    referenceType: {
      type: String, // sale, purchase, adjustment
    },

    referenceId: {
      type: mongoose.Schema.ObjectId,
    },
    movementDate: {
      type: Date,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

productLedgerSchema.index({
  productId: 1,
  companyId: 1,
  movementDate: 1,
});

module.exports = mongoose.model("ProductLedger", productLedgerSchema);
