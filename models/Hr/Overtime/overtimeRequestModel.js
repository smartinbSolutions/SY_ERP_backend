const mongoose = require("mongoose");

const overtimeRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "staff",
      required: true,
    },

    overtimeTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OvertimeType",
      required: true,
    },
    approval: {
      flowId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ApprovalFlow",
      },

      currentStep: {
        type: Number,
        default: 1,
      },

      currentApprover: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "staff",
      },

      steps: [
        {
          stepNumber: { type: Number, required: true },
          stepName: String,
          approverId: { type: mongoose.Schema.Types.ObjectId, ref: "staff" },
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

    workDate: {
      type: Date,
      required: true,
    },

    startTime: {
      type: Date,
      required: true,
    },

    endTime: {
      type: Date,
      required: true,
    },

    hours: {
      type: Number,
    },

    reason: {
      type: String,
      required: true,
      trim: true,
    },

    attachment: {
      type: String,
    },

    rejectionReason: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
    },

    companyId: String,
  },

  {
    timestamps: true,
  },
);

const setAttachmentURL = (doc) => {
  if (doc.attachment && !doc.attachment.startsWith("http")) {
    doc.attachment = `${process.env.BASE_URL}/overtimeAttachments/${doc.attachment}`;
  }
};

overtimeRequestSchema.post("init", function (doc) {
  setAttachmentURL(doc);
});

overtimeRequestSchema.post("save", function (doc) {
  setAttachmentURL(doc);
});

module.exports = mongoose.model("OvertimeRequest", overtimeRequestSchema);
