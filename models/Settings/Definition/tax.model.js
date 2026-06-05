const mongoose = require("mongoose");

const TaxSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
    },

    tax: {
      type: Number,
      required: true,
      min: 0,
    },

    description: {
      type: String,
      trim: true,
      default: null,
    },

    slug: {
      type: String,
      lowercase: true,
      trim: true,
    },

    isDefault: {
      type: Boolean,
      default: false,
      index: true,
    },

    salesAccountTax: {
      type: mongoose.Schema.ObjectId,
      ref: "AccountingTree",
      default: null,
    },

    purchaseAccountTax: {
      type: mongoose.Schema.ObjectId,
      ref: "AccountingTree",
      default: null,
    },

    sync: {
      type: Boolean,
      default: false,
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    oldId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

TaxSchema.index({ companyId: 1, name: 1 }, { unique: true });
TaxSchema.index({ companyId: 1, slug: 1 }, { unique: true });
TaxSchema.index(
  { companyId: 1, isDefault: 1 },
  { unique: true, partialFilterExpression: { isDefault: true } },
);
TaxSchema.index({ companyId: 1, isActive: 1 });
TaxSchema.index({ companyId: 1, createdAt: -1 });

module.exports = mongoose.model("Tax", TaxSchema);
