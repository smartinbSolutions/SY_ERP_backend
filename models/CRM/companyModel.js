const mongoose = require("mongoose");

const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    industry: { type: String, trim: true },
    website: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
    },
    annualRevenue: { type: Number, min: 0 }, 
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },
    companyId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    tags: [String],
    customFields: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
    notes: { type: String, maxlength: 2000 },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

companySchema.index({ companyId: 1, name: 1 });
companySchema.index({ companyId: 1, ownerId: 1 });
companySchema.index({ companyId: 1, isActive: 1 });
companySchema.index({ companyId: 1, deletedAt: 1 });

module.exports = mongoose.model("Company", companySchema);
