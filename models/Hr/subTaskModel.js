const mongoose = require("mongoose");

const subTaskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
    },

    code: {
      type: String,
    },

    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["todo", "in_progress", "done"],
      default: "todo",
      index: true,
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },

    missionType: {
      type: String,
      enum: ["task", "bug", "feature", "request"],
      default: "task",
    },

    tags: [
      {
        type: String,
      },
    ],

    assignedTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "staff",
        index: true,
      },
    ],

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "staff",
      required: true,
    },

    startDate: {
      type: Date,
    },

    dueDate: {
      type: Date,
      index: true,
    },

    completedAt: {
      type: Date,
    },

    companyId: {
      type: String,
      required: true,
      index: true,
    },

    order: {
      type: Number,
    }, // لترتيب المهام الفرعية داخل المهمة الرئيسية
  },
  { timestamps: true },
);

module.exports = mongoose.model("SubTask", subTaskSchema);
