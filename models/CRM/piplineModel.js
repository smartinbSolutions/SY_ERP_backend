const mongoose = require("mongoose");

const stageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true, lowercase: true, trim: true },
    order: { type: Number, required: true, min: 1 },
    probability: { type: Number, min: 0, max: 100, default: 0 },
    description: { type: String },
    expectedDuration: { type: Number, default: 14 },
    maxDurationDays: { type: Number, default: 30 },
    exitCriteria: [String],
    requiredActions: [
      {
        type: {
          type: String,
          enum: ["call", "email", "meeting", "note", "task"],
        },
        title: String,
        isMandatory: { type: Boolean, default: false },
      },
    ],
  },
  { _id: true },
);

const pipelineSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    stages: [stageSchema],
    settings: {
      allowSkipStages: { type: Boolean, default: false },
      requireExitCriteria: { type: Boolean, default: false },
      autoMoveOnWon: { type: Boolean, default: true },
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Pipeline", pipelineSchema);
