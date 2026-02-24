const mongoose = require("mongoose");

const overtimeTypeSchema = new mongoose.Schema(
  {
    policyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OvertimePolicy",
      required: true,
    },

    companyId: {
      type: String,
      required: true,
      index: true,
    },

    typeKey: {
      type: String,
      required: true,
      enum: ["normal", "holiday"],
    },

    rateMultiplier: {
      type: Number,
      required: true,
    },

    weeklyLimit: {
      type: Number,
      default: null,
    },

    dailyLimit: {
      type: Number,
      default: null,
    },

    givesLeaveBalance: {
      type: Boolean,
      default: false,
    },

    leaveMultiplier: {
      type: Number,
      default: 0,
    },

    requiresAttachment: {
      type: Boolean,
      default: false,
    },

    applicableDayType: {
      type: String,
      enum: ["workday", "holiday", "both"],
      default: "workday",
    },

  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("OvertimeType", overtimeTypeSchema);
