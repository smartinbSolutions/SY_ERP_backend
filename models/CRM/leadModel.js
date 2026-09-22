const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    companyName: { type: String, trim: true },
    jobTitle: { type: String, trim: true },

    source: {
      type: String,
      enum: [
        "website",
        "referral",
        "ads",
        "cold_call",
        "event",
        "social",
        "other",
      ],
      default: "other",
    },
    status: {
      type: String,
      enum: [
        "new",
        "contacted",
        "qualified",
        "unqualified",
        "lost",
        "converted",
      ],
      default: "new",
    },

    score: { type: Number, min: 0, max: 100, default: 0 },

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

    bant: {
      budget: {
        confirmed: { type: Boolean, default: false },
        amount: { type: Number, default: 0 },
        notes: String,
      },
      authority: {
        isDecisionMaker: { type: Boolean, default: false },
        decisionMakerName: String,
        notes: String,
      },
      need: {
        painPoint: String,
        impact: String,
        urgency: {
          type: String,
          enum: ["low", "medium", "high"],
          default: "low",
        },
      },
      timeline: {
        expectedStart: Date,
        deadline: Date,
        urgency: {
          type: String,
          enum: ["someday", "year", "quarter", "urgent"],
          default: "someday",
        },
      },
      score: { type: Number, min: 0, max: 12, default: 0 },
    },

    convertedTo: {
      contactId: { type: mongoose.Schema.Types.ObjectId, ref: "Contact" },
      crmCompanyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company" }, // ← غيّرنا الاسم
      opportunityId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Opportunity",
      },
      convertedAt: Date,
      convertedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },

    lostReason: { type: String },
    tags: [String],
    notes: { type: String },

    // 🗑️ Soft delete
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

leadSchema.index({ companyId: 1, status: 1 });
leadSchema.index({ companyId: 1, ownerId: 1 });
leadSchema.index({ companyId: 1, source: 1 });
leadSchema.index({ companyId: 1, email: 1 });
leadSchema.index({ companyId: 1, deletedAt: 1 });

leadSchema.index(
  { companyId: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $exists: true, $ne: null } },
  },
);

module.exports = mongoose.model("Lead", leadSchema);
