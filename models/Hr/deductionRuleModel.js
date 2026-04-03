const mongoose = require("mongoose");

const deductionRuleSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: true,
      index: true,
    },

    violationType: {
      type: String,
      enum: ["late", "severe_late", "absence", "early_leave", "no_punch"],
      required: true,
    },

    occurrence: {
      type: String, // "1", "2", ">3"
      required: true,
    },

    actionType: {
      type: String,
      enum: ["warning", "deduction", "escalation"],
      required: true,
    },

    deductionUnit: {
      type: String,
      enum: ["day", "hour", "fixed"],
      default: null,
    },

    deductionValue: {
      type: Number,
      default: null,
    },

    escalateToHR: {
      type: Boolean,
      default: false,
    },

    requiresApproval: {
      type: Boolean,
      default: false,
    },

    note: String,
  },
  {
    timestamps: true,
  },
);

deductionRuleSchema.index(
  { companyId: 1, violationType: 1, occurrence: 1 },
  { unique: true },
);

module.exports = mongoose.model("DeductionRule", deductionRuleSchema);
