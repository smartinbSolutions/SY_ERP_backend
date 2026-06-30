const mongoose = require("mongoose");

const approvalFlowSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    companyId: {
      type: String,
      required: true,
      index: true,
    },

    steps: [
      {
        stepNumber: {
          type: Number,
          required: true,
        },

        isDirectManager: {
          type: Boolean,
          default: false,
        },

        approver: {
          employeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "staff",
          },

          positionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Positions",
          },
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("ApprovalFlow", approvalFlowSchema);
