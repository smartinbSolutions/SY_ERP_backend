const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    jobTitle: { type: String, trim: true },

    companyId: {
      type: String,
      index: true,
      trim: true,
    },

    crmCompanyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    source: {
      type: String,
      enum: ["website", "referral", "ads", "cold_call", "event", "other"],
      default: "other",
    },

    tags: [String],
    notes: { type: String },
    isPrimary: { type: Boolean, default: false },

    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

contactSchema.index({ companyId: 1, email: 1 });
contactSchema.index({ companyId: 1, ownerId: 1 });
contactSchema.index({ companyId: 1, crmCompanyId: 1 });
contactSchema.index({ companyId: 1, status: 1 });
contactSchema.index({ companyId: 1, deletedAt: 1 });

contactSchema.index(
  { companyId: 1, email: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);

module.exports = mongoose.model("Contact", contactSchema);
