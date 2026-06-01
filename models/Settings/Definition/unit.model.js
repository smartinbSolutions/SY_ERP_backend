const mongoose = require("mongoose");

const UnitSchema = new mongoose.Schema(
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

    nameAr: {
      type: String,
      trim: true,
      default: null,
    },

    code: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    slug: {
      type: String,
      lowercase: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
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

UnitSchema.index({ companyId: 1, name: 1 }, { unique: true });
UnitSchema.index({ companyId: 1, code: 1 }, { unique: true, sparse: true });
UnitSchema.index({ companyId: 1, slug: 1 }, { unique: true });
UnitSchema.index({ companyId: 1, isActive: 1 });
UnitSchema.index({ companyId: 1, createdAt: -1 });

module.exports = mongoose.model("Unit", UnitSchema);
