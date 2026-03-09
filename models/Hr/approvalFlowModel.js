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

    module: {
      type: String,
      enum: ["leave", "advance", "overtime"],
      required: true,
    },

    steps: [
      {
        stepNumber: {
          type: Number,
          required: true,
        },

        approver: {
     
          employeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "staff",
          },

          positionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Position",
          },
        },

        delegate: {
      
          employeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "staff",
          },

          positionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Position",
          },
        },
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("ApprovalFlow", approvalFlowSchema);
