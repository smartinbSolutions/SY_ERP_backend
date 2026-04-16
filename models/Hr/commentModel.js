const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: true,
      trim: true,
    },

    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
    },

    subTask: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubTask",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      }, // قائمة المستخدمين الذين تم ذكرهم في التعليق
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Comment", commentSchema);
