const mongoose = require("mongoose");

const advanceTypeSchema = new mongoose.Schema(
  {
    policyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdvancePolicy",
      required: [true, "Policy ID is required"],
    },
    approvalFlow: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ApprovalFlow",
    },

    companyId: {
      type: String,
      index: true,
    },

    typeKey: {
      type: String,
      enum: ["monthly", "emergency"],
      required: [true, "Type Key is required"],
    },

    maxPercentageOfSalary: {
      type: Number,
      required: [true, "Max percentage of salary is required"],
      min: [0.01, "Must be greater than 0"],
    },

    requiresAttachment: {
      type: Boolean,
      default: false,
    },

    allowInstallments: {
      type: Boolean,
      default: false,
    },

    maxMonthsInstallments: {
      type: Number,
      default: 1,
    },

    maxInstallmentPercentage: {
      type: Number,
      default: 1,
    },

    minMonthsAfterJoin: {
      type: Number,
      default: 3,
      min: [0, "Must be at least 0 months"],
    },
  },
  {
    timestamps: true,
  },
);

advanceTypeSchema.index({ policyId: 1, typeKey: 1 }, { unique: true });

module.exports = mongoose.model("AdvanceType", advanceTypeSchema);
