const mongoose = require("mongoose");

const tagSchema = new mongoose.Schema(
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

    nameTr: {
      type: String,
      trim: true,
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

    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tag",
      default: null,
      index: true,
    },
    sync: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true },
);

tagSchema.index({ companyId: 1, name: 1 }, { unique: true });
tagSchema.index({ companyId: 1, slug: 1 }, { unique: true });
tagSchema.index({ companyId: 1, parentId: 1 });
tagSchema.index({ companyId: 1, type: 1 });
tagSchema.index({ companyId: 1, createdAt: -1 });

module.exports = mongoose.model("Tag", tagSchema);
