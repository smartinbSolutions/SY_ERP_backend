const mongoose = require("mongoose");

const opportunityProductSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    discount: { type: Number, min: 0, max: 100, default: 0 },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: true },
);

const stageHistorySchema = new mongoose.Schema(
  {
    stageKey: { type: String, required: true }, //the key of the stage in the pipeline
    stageName: String,
    enteredAt: { type: Date, default: Date.now },
    exitedAt: Date,
    durationDays: Number,
    movedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    notes: String,
  },
  { _id: true },
);

const opportunitySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String },
    value: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "USD", uppercase: true },

    pipelineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pipeline",
      required: true,
    },
    currentStageKey: { type: String, required: true }, //the key of the current stage in the pipeline
    currentStageOrder: { type: Number, required: true }, //the order of the current stage in the pipeline
    probability: { type: Number, min: 0, max: 100, default: 0 },
    stageHistory: [stageHistorySchema],

    crmCompanyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    contactIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Contact" }],
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      default: null,
    },

    products: [opportunityProductSchema],

    expectedCloseDate: { type: Date },
    actualCloseDate: Date,

    status: { type: String, enum: ["open", "won", "lost"], default: "open" },

    lostReason: { type: String },
    lostReasonCategory: {
      type: String,
      enum: ["price", "competitor", "timing", "no_budget", "no_need", "other"],
    },

    bant: {
      budget: { confirmed: Boolean, amount: Number, notes: String },
      authority: { isDecisionMaker: Boolean, decisionMakerName: String },
      need: { painPoint: String, impact: String, urgency: String },
      timeline: { expectedStart: Date, deadline: Date, urgency: String },
      score: { type: Number, min: 0, max: 12, default: 0 },
    },

    dealId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Deal",
      default: null,
    },

    tags: [String],
    deletedAt: { type: Date, default: null },
    companyId: {
      type: String,
      index: true,
      trim: true,
    },
  },
  { timestamps: true },
);

opportunitySchema.index({ companyId: 1, status: 1 });
opportunitySchema.index({ companyId: 1, pipelineId: 1 });
opportunitySchema.index({ companyId: 1, ownerId: 1 });
opportunitySchema.index({ companyId: 1, deletedAt: 1 });


module.exports = mongoose.model("Opportunity", opportunitySchema);
