const mongoose = require("mongoose");

const menuOrderSchema = new mongoose.Schema(
  {
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
      },
    ],
    totalPrice: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["pending", "inProgress", "completed", "cancelled", "failed"],
      default: "pending",
    },
    processedBy: { type: String },
    companyId: {
      type: String,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MenuOrder", menuOrderSchema);
