const mongoose = require("mongoose");

const referenceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["person", "company", "partner"],
      default: "person",
    },
    phone: { type: String, trim: true },
    whatsApp: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    number: { type: String, trim: true },

    companyId: { type: String, required: true, index: true, trim: true },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    notes: { type: String },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

referenceSchema.index({ companyId: 1, deletedAt: 1 });
referenceSchema.index(
  { companyId: 1, number: 1 },
  { unique: true, partialFilterExpression: { number: { $type: "string" } } },
);

module.exports = mongoose.model("Reference", referenceSchema);
