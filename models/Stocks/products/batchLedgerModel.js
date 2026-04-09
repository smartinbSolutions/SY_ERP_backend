const mongoose = require("mongoose");

const batchLedgerSchema = new mongoose.Schema(
  {
    batchId: {
      type: mongoose.Schema.ObjectId,
      ref: "ProductBatch",
      required: true,
      index: true,
    },

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
      index: true,
    },

    type: {
      type: String,
      enum: ["in", "out"],
      required: true,
      index: true,
    },

    quantity: {
      type: Number,
      required: true,
    },

    referenceType: {
      type: String,
      index: true,
    },

    referenceId: {
      type: mongoose.Schema.ObjectId,
      index: true,
    },

    movementDate: {
      type: Date,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

batchLedgerSchema.index({
  batchId: 1,
  movementDate: 1,
});

batchLedgerSchema.index({
  productId: 1,
  companyId: 1,
  movementDate: 1,
});

module.exports = mongoose.model("BatchLedger", batchLedgerSchema);
