const mongoose = require("mongoose");
const { MODULES, MODULE_KEYS } = require("../../../shared/modules");

const MAX_TAG_DEPTH = 5;

const tagSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: true,
      index: true,
    },

    // NEW
    module: {
      type: String,
      required: true,
      enum: MODULE_KEYS,
      lowercase: true,
      trim: true,
      index: true,
    },

    // NEW
    scope: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function (v) {
          return (MODULES[this.module]?.scopes || []).includes(v);
        },
        message: "Invalid scope for this module",
      },
    },

    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
    },

    nameAr: { type: String, trim: true, default: null },
    nameTr: { type: String, trim: true, default: null },

    slug: {
      type: String,
      lowercase: true,
      trim: true,
    },

    description: { type: String, trim: true, default: null },

    color: {
      type: String,
      trim: true,
      default: "",
      match: [
        /^#([0-9a-f]{3}|[0-9a-f]{6})$/i,
        "Invalid color, use hex like #1B84FF",
      ],
    },

    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tag",
      default: null,
      index: true,
    },

    // NEW
    ancestors: [{ type: mongoose.Schema.Types.ObjectId, ref: "Tag" }],
    depth: { type: Number, default: 0 },
    order: { type: Number, default: 0 },

    sync: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true },
);

// CHANGED: unique among siblings, inside company + module + scope
tagSchema.index(
  { companyId: 1, module: 1, scope: 1, parentId: 1, name: 1 },
  { unique: true },
);
tagSchema.index(
  { companyId: 1, module: 1, scope: 1, parentId: 1, slug: 1 },
  { unique: true },
);
tagSchema.index({ companyId: 1, module: 1, scope: 1, ancestors: 1 }); // NEW
tagSchema.index({ companyId: 1, createdAt: -1 });

// NEW: parent must match company/module/scope, build ancestors + depth, block cycles
tagSchema.pre("save", async function () {
  if (!this.isNew && !this.isModified("parentId")) return;

  if (!this.parentId) {
    this.ancestors = [];
    this.depth = 0;
    return;
  }

  const parent = await this.constructor.findOne({
    _id: this.parentId,
    companyId: this.companyId,
    module: this.module,
    scope: this.scope,
  });
  if (!parent)
    throw new Error("Parent tag must be in the same module and scope");

  if (
    String(parent._id) === String(this._id) ||
    parent.ancestors.some((id) => String(id) === String(this._id))
  ) {
    throw new Error("Cannot move a tag under itself or its descendants");
  }

  this.ancestors = [...parent.ancestors, parent._id];
  this.depth = this.ancestors.length;
  if (this.depth >= MAX_TAG_DEPTH) throw new Error("Tag tree too deep");
});

module.exports = mongoose.model("Tag", tagSchema);
