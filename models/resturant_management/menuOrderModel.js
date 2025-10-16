const mongoose = require("mongoose");
const menuOrderSchema = new mongoose.Schema(
  {
    table: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Table",
    },
    orderNote: String,
    orderItems: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "manufactorProduct",
          required: true,
        },
        quantity: { type: Number, required: true },
        unitPrice: { type: Number, required: true },
        totalPrice: { type: Number, required: true },
        status: String,
        processedBy: String,
        note: String,
      },
    ],
    totalPrice: { type: Number, default: 0 },
    orderStatus: {
      type: String,
    },
    salePointId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "salesPoints",
    },

    orderProcessedBy: { type: String },
    companyId: {
      type: String,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MenuOrder", menuOrderSchema);
