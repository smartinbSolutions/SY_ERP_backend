const mongoose = require("mongoose");

const actionExecutionLogSchema = new mongoose.Schema(
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

    occurrenceCount: {
      type: Number,
      required: true,
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

    actionType: {
      type: String,
      enum: ["warning", "deduction", "escalation"],
      required: true,
      index: true,
    },

    deduction: {
      unit: {
        type: String,
        enum: ["day", "hour", "minutes", "fixed"],
      },
      value: Number,
      amount: Number,
    },

    sourceRuleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeductionTypes",
    },

    status: {
      type: String,
      enum: ["pending", "done"],
      default: "done",
    },

    executedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

actionExecutionLogSchema.index(
  {
    userId: 1,
    violationType: 1,
    occurrenceCount: 1,
    periodStart: 1,
    periodEnd: 1,
  },
  { unique: true },
);

module.exports = mongoose.model("ActionExecutionLog", actionExecutionLogSchema);
