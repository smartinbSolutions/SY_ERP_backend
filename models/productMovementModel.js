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
    outPrice: { type: Number, default: 0 },
    enterPrice: { type: Number, default: 0 },
    stockId: String,
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
        "Sales Invoice",
        "Stock reconciliation",
        "Stock Transfer",
      ],
      required: true,
    },
    desc: String,
    sync: { type: Boolean, default: false },
    companyId: {
      type: String,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);
module.exports = mongoose.model("ProductMovement", ProductMovementSchema);
