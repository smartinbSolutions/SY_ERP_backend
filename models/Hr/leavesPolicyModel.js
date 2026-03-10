const mongoose = require("mongoose");

const leavePolicySchema = new mongoose.Schema(
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
      index: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("LeavePolicy", leavePolicySchema);
