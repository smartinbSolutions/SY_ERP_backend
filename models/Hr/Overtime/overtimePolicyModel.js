const { default: mongoose } = require("mongoose");

const overtimePolicySchema = new mongoose.Schema(
  {
    policyName: {
      type: String,
      required: true,
    },
    approvalFlow: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ApprovalFlow",
    },

    code: String,

    companyId: {
      type: String,
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("OvertimePolicy", overtimePolicySchema);
