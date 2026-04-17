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

    status: {
      type: String,
      enum: ["pending", "done"],
      default: "done",
    },

    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null, // DeductionLog / Notification 
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
    actionType: 1,
    periodStart: 1,
    periodEnd: 1,
  },
  { unique: true },
);

module.exports = mongoose.model("ActionExecutionLog", actionExecutionLogSchema);
