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

    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "staff",
      required: true,
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
