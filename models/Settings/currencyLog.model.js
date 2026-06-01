const mongoose = require("mongoose");

const currencyLogSchema = new mongoose.Schema(
  {
    sync: { type: Boolean, default: false },
    companyId: {
      type: String,
      required: true,
      index: true,
    },
    oldRate: Number,
    newRate: Number,
    updatedBy: String,
    changeType: {
      type: String,
      enum: ["initial", "update", "manual"],
      required: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("CurrencyLog", currencyLogSchema);
