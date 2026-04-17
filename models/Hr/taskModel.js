const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
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
      // unique: true,
    },

    status: {
      type: String,
      enum: ["todo", "in_progress", "review", "done", "cancelled"],
      default: "todo",
      index: true,
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
      index: true,
    },

    missionType: {
      type: String,
      enum: ["task", "bug", "feature", "request"],
      default: "task",
    },

    tags: [
      {
        type: String,
        trim: true,
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

    subTasksCount: {
      type: Number,
      default: 0,
    },

    completedSubTasksCount: {
      type: Number,
      default: 0,
    },

    progress: {
      type: Number,
      default: 0,
    }, // progress percentage

    companyId: {
      type: String,
      required: true,
      index: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Task", taskSchema);
