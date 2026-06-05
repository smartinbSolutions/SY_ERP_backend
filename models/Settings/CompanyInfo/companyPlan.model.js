const mongoose = require("mongoose");

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    priceMonthly: Number,
    priceYearly: Number,

    features: {
      accounting: { type: Boolean, default: false },
      inventory: { type: Boolean, default: false },
      sales: { type: Boolean, default: false },
      purchases: { type: Boolean, default: false },
      hr: { type: Boolean, default: false },
      crm: { type: Boolean, default: false },
      manufacturing: { type: Boolean, default: false },
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "companyinfo",
      required: true,
      unique: true,
      index: true,
    },
    maxUsers: Number,
    maxBranches: Number,
    maxProducts: Number,

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("companyPlan", planSchema);
