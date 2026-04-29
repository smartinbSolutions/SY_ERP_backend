const mongoose = require("mongoose");

const timeLogSchema = new mongoose.Schema(
  {
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
      index: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "staff",
      required: true,
      index: true,
    },

    duration: {
      type: Number, // seconds
      required: true,
    },

    from: {
      type: Date,
    },

    to: {
      type: Date,
    },

    note: {
      type: String,
      trim: true,
    },

    type: {
      type: String,
      enum: ["manual", "tracked"],
      default: "manual",
    },

    companyId: {
      type: String,
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("TimeLog", timeLogSchema);
