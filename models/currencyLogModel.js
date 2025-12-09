const mongoose = require("mongoose");

const currencyLogSchema = new mongoose.Schema(
  {
    currencyId: {
      type: String,
      required: true,
      index: true,
    },
    oldRate: Number,
    newRate: Number,
    changeType: { type: String },
    updatedBy: String,
    companyId: String,
  },
  { timestamps: true }
);
currencyLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("CurrencyLog", currencyLogSchema);
