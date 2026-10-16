const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema(
  {
    LeadName: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    companyName: { type: String, trim: true },
    jobTitle: { type: String, trim: true },
    number: { type: String, trim: true },

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

    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reference",
      default: null,
      index: true,
      required: function () {
        return this.source === "referral";
      },
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

    country: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Country",
      default: null,
      index: true,
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
      index: true,
    },

    bant: {
      budget: {
        confirmed: { type: Boolean, default: false },
        amount: { type: Number, default: 0 },
        notes: String,
      },
      authority: {
        isDecisionMaker: {
          type: Boolean,
          default: false,
        },
        decisionMakerId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Contact",
          default: null,
          index: true,
        },
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

    interestedIn: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "product",
      },
    ],

    convertedTo: {
      contactId: { type: mongoose.Schema.Types.ObjectId, ref: "Contact" },
      crmCompanyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company" }, // ← غيّرنا الاسم
      opportunityId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Opportunity",
      },
      convertedAt: Date,
      convertedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    },

    lostReason: { type: String },

    tags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tag",
      },
    ],
    notes: { type: String },

    // 🗑️ Soft delete
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

leadSchema.pre("validate", function (next) {
  if (this.source !== "referral") {
    this.referenceId = null;
  }
  next();
});

leadSchema.index({ companyId: 1, status: 1 });
leadSchema.index({ companyId: 1, ownerId: 1 });
leadSchema.index({ companyId: 1, source: 1 });
leadSchema.index({ companyId: 1, deletedAt: 1 });
leadSchema.index({ companyId: 1, number: 1 }, { unique: true });

leadSchema.index(
  { companyId: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $exists: true, $ne: null } },
  },
);

module.exports = mongoose.model("Lead", leadSchema);
