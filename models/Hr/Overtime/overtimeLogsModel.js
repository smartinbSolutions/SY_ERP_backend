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

    // =========================
    // SNAPSHOT OF RULE (IMPORTANT)
    // =========================
    ruleSnapshot: {
      type: {
        typeKey: String,
        rateMultiplier: Number,
        leaveMultiplier: Number,
        weeklyLimit: Number,
        dailyLimit: Number,
        applicableDayType: String,
      },
    },

    // =========================
    // APPLIED CALCULATION (HISTORY)
    // =========================
    calculation: {
      hours: {
        type: Number,
        required: true,
      },

      appliedRateMultiplier: {
        type: Number,
        required: true,
      },

      appliedLeaveMultiplier: {
        type: Number,
        default: 0,
      },

      calculatedPay: {
        type: Number,
        default: 0,
      },

      leaveEarned: {
        type: Number,
        default: 0,
      },
    },

    // =========================
    // APPROVAL INFO
    // =========================
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
