const mongoose = require("mongoose");

const attachmentSchema = new mongoose.Schema(
  {
    fileName: String,
    fileType: String,
    fileSize: Number,

    entityType: {
      type: String,
      enum: ["Task", "SubTask"],
      required: true,
    },
    companyId: {
      type: String,
      required: true,
      index: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "staff",
      required: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Attachment", attachmentSchema);
