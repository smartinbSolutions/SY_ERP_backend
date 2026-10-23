const mongoose = require("mongoose");

const stageHistorySchema = new mongoose.Schema(
  {
    stageKey: { type: String, required: true }, //the key of the stage in the pipeline
    stageName: String,
    enteredAt: { type: Date, default: Date.now },
    exitedAt: Date,
    durationDays: Number,
    movedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    notes: String,
  },
  { _id: true },
);

const opportunitySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    // Summary. Filled from the lead notes on conversion, editable.
    description: { type: String },
    value: { type: Number, required: true, min: 0 },
    // One of the company's currencies (ref), not a free string.
    currency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Currency",
      required: true,
    },
    number: { type: String, trim: true },
    pipelineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pipeline",
      required: true,
    },
    currentStageKey: { type: String, required: true }, //the key of the current stage in the pipeline
    currentStageOrder: { type: Number, required: true }, //the order of the current stage in the pipeline
    // Always the current stage's probability (set on convert and on every stage move).
    probability: { type: Number, min: 0, max: 100, default: 0 },
    stageHistory: [stageHistorySchema],

    // The one contact. The CRM company is read from the contact
    // (contact.crmCompanyId), it is not stored here.
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contact",
      required: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      default: null,
    },

    // Ids only. Quantities and prices belong to the quotation.
    interestedIn: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "product",
      },
    ],

    source: { type: String, trim: true },

    // Set by the user. No default, no computed value.
    riskLevel: {
      type: String,
      enum: ["low", "medium", "high"],
      set: (v) => v || undefined, // "" from a form means "not set"
    },

    expectedCloseDate: { type: Date },
    actualCloseDate: Date,

    status: { type: String, enum: ["open", "won", "lost"], default: "open" },

    lostReason: { type: String },
    lostReasonCategory: {
      type: String,
      enum: ["price", "competitor", "timing", "no_budget", "no_need", "other"],
    },

    // new field to track the status of exit criteria for each stage
    exitCriteriaStatus: [
      {
        criteria: {
          type: String,
          trim: true,
        },
        isCompleted: {
          type: Boolean,
          default: false,
        },
        completedAt: {
          type: Date,
          default: null,
        },
      },
    ],

    // new field to track the status of required actions for each stage
    requiredActionsStatus: [
      {
        type: {
          type: String,
          enum: ["call", "email", "meeting", "note", "task"],
        },
        title: {
          type: String,
          trim: true,
        },
        isMandatory: {
          type: Boolean,
          default: false,
        },
        isCompleted: {
          type: Boolean,
          default: false,
        },
        completedAt: {
          type: Date,
          default: null,
        },
      },
    ],

    tags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tag",
      },
    ],
    deletedAt: { type: Date, default: null },
    // Tenant key (global, not the CRM company)
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
opportunitySchema.index({ companyId: 1, contactId: 1 });
opportunitySchema.index({ companyId: 1, deletedAt: 1 });
opportunitySchema.index({ companyId: 1, number: 1 }, { unique: true });

module.exports = mongoose.model("Opportunity", opportunitySchema);
