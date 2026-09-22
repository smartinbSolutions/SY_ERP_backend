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

    companyId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
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
    attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],

    emailData: {
      from: String,
      to: [String],
      cc: [String],
      body: String,
    },

    reminderAt: Date,
    reminderSent: { type: Boolean, default: false },

    tags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tag",
      },
    ],
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

activitySchema.index({ companyId: 1, status: 1 });
activitySchema.index({ companyId: 1, ownerId: 1 });
activitySchema.index({ companyId: 1, type: 1 });
activitySchema.index({ companyId: 1, "relatedTo.type": 1, "relatedTo.id": 1 });
activitySchema.index({ companyId: 1, deletedAt: 1 });

module.exports = mongoose.model("Activity", activitySchema);
