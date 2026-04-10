const mongoose = require("mongoose");

const ProductMovementSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "product",
      required: true,
    },
    reference: { type: mongoose.Schema.ObjectId, refPath: "referenceModel" },
    referenceModel: { type: String },
    enterPrice: { type: Number, default: 0 },
    buyingPrice: String,
    outPrice: { type: Number, default: 0 },
    sellingPrice: String,
    exchangeRate: { type: Number, default: 1 },
    stockId: { type: mongoose.Schema.ObjectId, ref: "Stock" },
    quantity: {
      type: Number,
      default: 0,
    },
    newQuantity: {
      type: Number,
      default: 0,
    },
    movementType: {
      type: String,
      enum: ["in", "out"],
    },
    source: {
      type: String,
      enum: [
        "Create",
        "Purchase Invoice",
        "Purchase Invoice Cancellation",
        "Sales Invoice",
        "Stock reconciliation",
        "Stock Transfer",
        "Refund Sales Invoice",
        "Opening Inventory",
        "Refund POS Receipt",
        "POS Receipt",
        "Refund Purchase Invoice",
        "Purchase Invoice Reverse Update",
        "Sales Invoice Cancellation",
      ],
      required: true,
    },
    desc: String,
    sync: { type: Boolean, default: false },
    movementDate: {
      type: Date,
      required: true,
      index: true,
    },

    companyId: {
      type: String,
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

ProductMovementSchema.index({ productId: 1, companyId: 1, createdAt: -1 });
module.exports = mongoose.model("ProductMovement", ProductMovementSchema);
