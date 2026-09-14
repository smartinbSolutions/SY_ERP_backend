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
      enum: ["new", "contacted", "qualified", "unqualified", "lost"],
      default: "new",
    },
    score: { type: Number, min: 0, max: 100, default: 0 }, //the lead score based on engagement and other factors
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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
        painPoint: String, //the main problem or challenge the lead is facing
        impact: String, //the effect of the problem on the lead's business or life
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
      score: { type: Number, min: 0, max: 12, default: 0 }, //the total BANT score based on the above factors
    },

    convertedTo: {
      contactId: { type: mongoose.Schema.Types.ObjectId, ref: "Contact" },
      companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company" },
      opportunityId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Opportunity",
      },
      convertedAt: Date,
      convertedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },

    lostReason: { type: String }, //the reason why the lead was lost or disqualified
    tags: [String],
    notes: { type: String },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Lead", leadSchema);
