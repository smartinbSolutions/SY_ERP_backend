const mongoose = require("mongoose");

const advanceRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "staff",
      required: true,
      index: true,
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
        index: true,
      },

      steps: [
        {
          stepNumber: {
            type: Number,
            required: true,
          },

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

      //  use it later for quick reports and indexing for not updating the steps array
      //   history: [
      //     {
      //       stepNumber: Number,

      //       approverId: {
      //         type: mongoose.Schema.Types.ObjectId,
      //         ref: "staff",
      //       },

      //       action: {
      //         type: String,
      //         enum: ["approved", "rejected"],
      //       },

      //       comment: String,

      //       actedAt: {
      //         type: Date,
      //         default: Date.now,
      //       },
      //     },
      //   ],
    },



    advanceTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdvanceType",
      required: true,
    },

    // salary when he request the advance
    // salarySnapshot: {
    //   type: Number,
    //   required: true,
    // },

    amount: {
      type: Number,
      required: true,
    },

    //installment months
    installments: {
      type: Number,
      default: null,
    },

    installmentAmount: Number,

    reason: {
      type: String,
      trim: true,
    },

    attachment: String,

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "paid", "closed"],
      default: "pending",
    },

    rejectionReason: String,

    approvedAt: Date,

    companyId: {
      type: String,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

const setAttachmentURL = (doc) => {
  if (doc.attachment && !doc.attachment.startsWith("http")) {
    doc.attachment = `${process.env.BASE_URL}/advanceAttachments/${doc.attachment}`;
  }
};

advanceRequestSchema.post("init", function (doc) {
  setAttachmentURL(doc);
});

advanceRequestSchema.post("save", function (doc) {
  setAttachmentURL(doc);
});

module.exports = mongoose.model("AdvanceRequest", advanceRequestSchema);
