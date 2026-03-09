const mongoose = require("mongoose");

const advanceLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "staff",
      required: true,
      index: true,
    },

    advanceRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdvanceRequest",
      required: true,
      unique: true,
      index: true,
    },

    advanceTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdvanceType",
      required: true,
    },

    // salary when he request the advance
    salarySnapshot: {
      type: Number,
      required: true,
    },

    approvedAmount: {
      type: Number,
      required: true,
    },

    installments: {
      type: Number,
      default: null,
    },

    installmentAmount: {
      type: Number,
      default: null,
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

module.exports = mongoose.model("AdvanceLog", advanceLogSchema);
