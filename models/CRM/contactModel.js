const mongoose = require("mongoose");

const CONTACT_TYPES = [
  "decision_maker",
  "influencer",
  "supplier",
  "consultant",
];
const CONTACT_LANGUAGES = ["ar", "en"];

const contactSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    jobTitle: { type: String, trim: true },
    number: { type: String, trim: true },

    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    whatsApp: { type: String, trim: true },

    preferredLanguage: { type: String, enum: CONTACT_LANGUAGES },
    contactType: { type: String, enum: CONTACT_TYPES },

    companyId: { type: String, index: true, trim: true },

    // Primary company.
    crmCompanyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    tags: [{ type: mongoose.Schema.Types.ObjectId, ref: "Tag" }],

    notes: { type: String },
    isPrimary: { type: Boolean, default: false },

    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

contactSchema.index({ companyId: 1, status: 1 });
contactSchema.index({ companyId: 1, assignedTo: 1 });
contactSchema.index({ companyId: 1, contactType: 1 });
contactSchema.index({ companyId: 1, deletedAt: 1 });
contactSchema.index({ companyId: 1, number: 1 }, { unique: true });

contactSchema.index(
  { companyId: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: null, email: { $type: "string" } },
  },
);
contactSchema.index(
  { companyId: 1, crmCompanyId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isPrimary: true,
      crmCompanyId: { $type: "objectId" },
    },
  },
);

module.exports = mongoose.model("Contact", contactSchema);
module.exports.CONTACT_TYPES = CONTACT_TYPES;
module.exports.CONTACT_LANGUAGES = CONTACT_LANGUAGES;
