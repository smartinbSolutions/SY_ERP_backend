const { default: mongoose } = require("mongoose");

const ShortageSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "product" },
    currentQty: Number,
    minimumQty: Number,
    neededQty: Number,
    companyId: String,
    status: {
      type: String,
      //   enum: ["pending", "ordered", "done"],
      default: "pending",
    },
    notes: String,
    date: String,
  },
  { timestamps: true }
);
ShortageSchema.index({ companyId: 1, status: 1, productId: 1 });

module.exports = mongoose.model("Shortage", ShortageSchema);
