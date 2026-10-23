const mongoose = require("mongoose");

const COMPANY_STATUSES = ["prospect", "active", "dormant", "blacklisted"];

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    number: { type: String, trim: true },

    // Lookups (managed in CRM Lists).
    classificationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lookup",
      default: null,
      index: true,
    },
    industryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Lookup" }],

    // Headquarters location.
    address: { type: String, trim: true },
    country: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Country",
      default: null,
      index: true,
    },

    // Other working countries.
    workingCountries: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Country" },
    ],

    website: { type: String, trim: true, lowercase: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    whatsApp: { type: String, trim: true },

    status: {
      type: String,
      enum: COMPANY_STATUSES,
      default: "prospect",
      required: true,
    },

    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customar",
      default: null,
      index: true,
    },

    companyId: { type: String, required: true, index: true, trim: true },

    tags: [{ type: mongoose.Schema.Types.ObjectId, ref: "Tag" }],
    notes: { type: String, maxlength: 2000 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

companySchema.index({ companyId: 1, name: 1 });
companySchema.index({ companyId: 1, status: 1 });
companySchema.index({ companyId: 1, ownerId: 1 });
companySchema.index({ companyId: 1, industryIds: 1 });
companySchema.index({ companyId: 1, deletedAt: 1 });
companySchema.index({ companyId: 1, number: 1 }, { unique: true });
companySchema.index(
  { companyId: 1, customerId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      deletedAt: null,
      customerId: { $type: "objectId" },
    },
  },
);

module.exports = mongoose.model("Company", companySchema);
module.exports.COMPANY_STATUSES = COMPANY_STATUSES;
