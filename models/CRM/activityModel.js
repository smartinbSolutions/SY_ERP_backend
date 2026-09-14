const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ["call", "email", "meeting", "note", "task"],
    },
    subject: { type: String, required: true, trim: true },
    description: { type: String },

    relatedTo: {
      type: {
        type: String,
        enum: ["Lead", "Contact", "Company", "Opportunity", "Deal"],
        required: true,
      },
      id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: "relatedTo.type",
      },
    },

    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    dueDate: { type: Date },
    completedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "cancelled"],
      default: "pending",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },

    duration: { type: Number, min: 0 },
    outcome: {
      type: String,
      enum: ["positive", "neutral", "negative", "no_answer", null],
      default: null,
    },
    attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],//for meetings and calls, the users involved in the activity

    emailData: {
      from: String,
      to: [String],
      cc: [String],
      body: String,
    },

    reminderAt: Date,
    reminderSent: { type: Boolean, default: false },

    tags: [String],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Activity", activitySchema);
