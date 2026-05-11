const mongoose = require("mongoose");

const checklistItemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    isDone: {
      type: Boolean,
      default: false,
    },

    completedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: true, timestamps: true },
);

// =========================
// TASK SCHEMA
// =========================

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    companyId: {
      type: String,
      required: true,
      index: true,
    },

    description: String,

    list: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "List",
      required: true,
      index: true,
    },

    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
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

    assignedTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "staff",
      },
    ],

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "staff",
      required: true,
    },

    dueDate: Date,
    startDate: Date,
    completedAt: Date,

    // =========================
    // SUBTASKS
    // =========================
    subTasksCount: { type: Number, default: 0 },
    completedSubTasksCount: { type: Number, default: 0 },
    progress: { type: Number, default: 0 },

    // =========================
    // CHECKLIST
    // =========================
    checklist: [checklistItemSchema],

    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Task", taskSchema);
