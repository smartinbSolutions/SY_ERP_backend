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
