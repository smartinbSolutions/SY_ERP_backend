const mongoose = require("mongoose");

const deductionSchema = new mongoose.Schema(
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

    source: {
      type: String,
      enum: ["violation", "manual"],
      required: true,
    },

    violationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ViolationLog",
      default: null,
    },

    amount: {
      type: Number,
      required: true,
    },

    unit: {
      type: String,
      enum: ["day", "hour", "fixed"],
      required: true,
    },

    reason: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "staff",
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "staff",
      default: null,
    },

    approvedAt: Date,

    cancelledAt: Date,
    cancelReason: String,
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Deduction", deductionSchema);
