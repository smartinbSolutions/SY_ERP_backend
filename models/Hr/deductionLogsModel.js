const mongoose = require("mongoose");

const deductionLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "staff",
      required: true,
      index: true,
    },

    companyId: {
      type: String,
      required: true,
      index: true,
    },

    violationType: {
      type: String,
      enum: ["late", "severe_late", "absence", "early_leave", "no_punch"],
      required: true,
      index: true,
    },

    periodStart: {
      type: Date,
      required: true,
      index: true,
    },

    periodEnd: {
      type: Date,
      required: true,
      index: true,
    },

    totalOccurrences: {
      type: Number,
      required: true,
    },

    deductionUnit: {
      type: String,
      enum: ["day", "hour", "fixed"],
      required: true,
    },

    deductionValue: {
      type: Number,
      required: true,
    },

    amountCalculated: {
      type: Number, // optional for now
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },

    policyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeductionPolicy",
      required: true,
    },

    relatedViolations: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ViolationLog",
      },
    ],

    processedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

deductionLogSchema.index(
  { userId: 1, violationType: 1, periodStart: 1, periodEnd: 1 },
  { unique: true },
);

module.exports = mongoose.model("DeductionLog", deductionLogSchema);
