const mongoose = require("mongoose");

const tagsSchema = new mongoose.Schema(
  {
    tagName: {
      type: String,
      require: true,
    },
    tagNameAr: {
      type: String,
    },
    tagNameTr: {
      type: String,
    },
    slug: {
      type: String,
      lowercase: true,
    },
    description: {
      type: String,
    },
    color: String,
    type: String,
    parentTag: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "tag",
      default: null,
    },
    children: [{ type: mongoose.Schema.Types.ObjectId, ref: "tag" }],
    sync: { type: Boolean, default: false },
    companyId: {
      type: String,
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("tag", tagsSchema);
