const mongoose = require("mongoose");

const overtimeLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "staff",
      required: true,
      index: true,
    },

    overtimeRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OvertimeRequest",
      required: true,
      unique: true,
      index: true,
    },

    overtimeType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OvertimeType",
      required: true,
    },

    hours: {
      type: Number,
      required: true,
    },

    rateMultiplier: {
      type: Number,
      required: true,
    },

    calculatedPay: {
      type: Number,
      default: 0,
    },

    leaveEarned: {
      type: Number,
      default: 0,
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "staff",
      required: true,
    },

    approvedAt: {
      type: Date,
      default: Date.now,
    },

    managerComment: {
      type: String,
      trim: true,
    },

    companyId: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("OvertimeLog", overtimeLogSchema);
