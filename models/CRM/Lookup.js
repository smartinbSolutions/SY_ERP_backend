const mongoose = require("mongoose");

const LOOKUP_TYPES = ["industry", "classification"];

const lookupSchema = new mongoose.Schema(
  {
    companyId: { type: String, required: true, index: true, trim: true },

    type: { type: String, enum: LOOKUP_TYPES, required: true },

    name: { type: String, required: true, trim: true },
    nameAr: { type: String, trim: true },
    nameTr: { type: String, trim: true },

    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

lookupSchema.index({ companyId: 1, type: 1, deletedAt: 1 });

// One name per list per company (soft-deleted records don't block reuse).
lookupSchema.index(
  { companyId: 1, type: 1, name: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);

module.exports = mongoose.model("Lookup", lookupSchema);
module.exports.LOOKUP_TYPES = LOOKUP_TYPES;
