const mongoose = require("mongoose");

const attachmentSchema = new mongoose.Schema(
  {
    fileName: {
      type: String,
      required: true,
    },

    fileType: String,
    fileSize: Number,

    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null,
    }, 

    subTask: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubTask",
      default: null,
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

attachmentSchema.virtual("downloadUrl").get(function () {
  return `${process.env.BASE_URL}/uploads/taskAttachments/${this.fileName}`;
});

attachmentSchema.set("toJSON", { virtuals: true });
attachmentSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Attachment", attachmentSchema);
