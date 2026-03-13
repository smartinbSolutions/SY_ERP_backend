const mongoose = require("mongoose");

const leaveRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "staff",
      required: true,
    },

    companyId: {
      type: String,
      required: true,
      index: true,
    },

    approval: {
      flowId: { type: mongoose.Schema.Types.ObjectId, ref: "ApprovalFlow" },
      currentStep: { type: Number, default: 1 },
      currentApprover: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "staff",
        index: true,
      },
      steps: [
        {
          stepNumber: { type: Number, required: true },
          stepName: { type: String },
          approverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "staff",
            default: null,
          },
          positionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Position",
            default: null,
          },
          status: {
            type: String,
            enum: ["pending", "approved", "rejected", "skipped"],
            default: "pending",
          },
          actedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "staff",
            default: null,
          },
          actedAt: Date,
          comment: String,
        },
      ],
    },

    approvedAt: Date,
    rejectionReason: String,

    leaveType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Leave",
      required: true,
    },

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    days: String,

    reason: {
      type: String,
      trim: true,
    },

    rejectionReason: {
      type: String,
      trim: true,
    },

    attachment: {
      type: String,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "staff",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

const setAttachmentURL = (doc) => {
  if (doc.attachment) {
    const attachmentURL = `${process.env.BASE_URL}/leaveAttachments/${doc.attachment}`;
    doc.attachment = attachmentURL;
  }
};

leaveRequestSchema.post("init", function (doc) {
  setAttachmentURL(doc);
});

//Create
leaveRequestSchema.post("save", (doc) => {
  setAttachmentURL(doc);
});

module.exports = mongoose.model("LeaveRequest", leaveRequestSchema);
