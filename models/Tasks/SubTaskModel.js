const mongoose = require("mongoose");

// =========================
// CHECKLIST ITEM
// =========================
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
  {
    timestamps: true,
  },
);

// =========================
// SUBTASK SCHEMA
// =========================

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

    startDate: Date,
    dueDate: {
      type: Date,
      index: true,
    },

    completedAt: Date,

    companyId: {
      type: String,
      required: true,
      index: true,
    },

    order: Number,

    // =========================
    // CHECKLIST 
    // =========================
    checklist: [checklistItemSchema],
  },
  { timestamps: true },
);

module.exports = mongoose.model("SubTask", subTaskSchema);
