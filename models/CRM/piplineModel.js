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
        isMandatory: { type: Boolean, default: false }, // is this action mandatory to move to the next stage
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

    // 🔒 Multi-tenant key — String
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
      index: true,
    },

    stages: [stageSchema],

    settings: {
      allowSkipStages: { type: Boolean, default: false },
      requireExitCriteria: { type: Boolean, default: false },
      autoMoveOnWon: { type: Boolean, default: true },
    },

    // 🗑️ Soft delete
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// 🔒 Indexes للـ multi-
pipelineSchema.index({ companyId: 1, isDefault: 1 });
pipelineSchema.index({ companyId: 1, isActive: 1 });
pipelineSchema.index({ companyId: 1, ownerId: 1 });
pipelineSchema.index({ companyId: 1, deletedAt: 1 });

pipelineSchema.index(
  { companyId: 1, name: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);

pipelineSchema
  .path("stages")
  .schema.index({ key: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Pipeline", pipelineSchema);
