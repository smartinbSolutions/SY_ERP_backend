const mongoose = require("mongoose");

const deductionPolicySchema = new mongoose.Schema(
  {
    policyName: {
      type: String,
      required: true,
    },

    companyId: {
      type: String,
      required: true,
      index: true,
    },

    code: String,

    maxMonthlyDeductionPercentage: {
      type: Number,
      default: 10,
    },

    approvalFlow: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ApprovalFlow",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("DeductionPolicy", deductionPolicySchema);
