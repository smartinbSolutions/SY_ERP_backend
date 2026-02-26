const mongoose = require("mongoose");

const advanceRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "staff",
      required: true,
      index: true,
    },

    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "staff",
      required: true,
    },

    advanceTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdvanceType",
      required: true,
    },

    // salary when he request the advance
    salarySnapshot: {
      type: Number,
      required: true,
    },

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
