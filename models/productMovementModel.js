const mongoose = require("mongoose");

const ProductMovementSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "product",
      required: true,
    },
    reference: { type: mongoose.Schema.ObjectId, refPath: "referenceModel" },
    sellingPrice: { type: Number, default: 0 },
    buyingPrice: { type: Number, default: 0 },
    quantity: {
      type: Number,
      default: 0,
    },
    newQuantity: {
      type: Number,
      default: 0,
    },
    oldPrice: {
      type: Number,
      default: 0,
    },
    newPrice: {
      type: Number,
      default: 0,
    },
    movementType: {
      type: String,
      enum: ["in", "out", "edit"],
    },
    type: String,
    source: {
      type: String,
      enum: ["purchase", "Sales Invoice", "create", "edit"],
      required: true,
    },
    referenceModel: {
      type: String,
    },
    oldCurrency: String,
    newCurrency: String,
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
