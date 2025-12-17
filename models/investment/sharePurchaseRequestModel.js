const mongoose = require("mongoose");

const sharePurchaseRequestModel = new mongoose.Schema(
  {
    investorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "investors",
    },
    type: String,
    shares: Number,
    sharePrice: Number,
    description: { type: String, default: "" },
    companyId: String,
    paymentStatus: { type: String, default: "unpaid" },
    status: { type: String, default: "pending" },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "SharePurchaseRequest",
  sharePurchaseRequestModel
);
