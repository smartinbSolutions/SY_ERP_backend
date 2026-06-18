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

    companyId: {
      type: String,
      required: true,
      index: true,
    },

    // ✅ FIXED: repayment fully defined
    repayment: {
      firstDeductionDate: {
        type: Date,
        default: null,
      },
    },

    // =========================
    // RULE SNAPSHOT
    // =========================
    ruleSnapshot: {
      typeKey: String,
      maxPercentageOfSalary: Number,
      allowInstallments: Boolean,
      maxMonthsInstallments: Number,
      maxInstallmentPercentage: Number,
      minMonthsAfterJoin: Number,
    },

    // =========================
    // CALCULATION
    // =========================
    calculation: {
      requestedAmount: { type: Number, default: 0 },
      approvedAmount: { type: Number, default: 0 },
      salarySnapshot: { type: Number, default: 0 },
      appliedPercentageOfSalary: { type: Number, default: 0 },
      installments: { type: Number, default: null },
      installmentAmount: { type: Number, default: null },
      remainingAfterApproval: { type: Number, default: 0 },
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

     shouldDeduct: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("AdvanceLog", advanceLogSchema);
