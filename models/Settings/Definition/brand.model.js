const mongoose = require("mongoose");

const brandSchema = new mongoose.Schema(
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
      minlength: 2,
    },

    nameAR: { type: String, trim: true, default: null },
    nameTR: { type: String, trim: true, default: null },

    slug: {
      type: String,
      lowercase: true,
      trim: true,
    },

    description: { type: String, trim: true, default: null },

    image: { type: String, trim: true, default: null },

    ecommerceVisible: {
      type: Boolean,
      default: true,
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    sync: {
      type: Boolean,
      default: false,
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

const setImageURL = (doc) => {
  if (doc.image) {
    const imageUrl = `brand/${doc.image}`;
    doc.image = imageUrl;
  }
};

brandSchema.post("init", function (doc) {
  if (Array.isArray(doc)) {
    doc.forEach(setImageURL);
  } else {
    setImageURL(doc);
  }
});

//Create
brandSchema.post("save", (doc) => {
  setImageURL(doc);
});

brandSchema.index({ companyId: 1, name: 1 }, { unique: true });
brandSchema.index({ companyId: 1, slug: 1 }, { unique: true });
brandSchema.index({ companyId: 1, isActive: 1 });
brandSchema.index({ companyId: 1, createdAt: -1 });
brandSchema.index({ name: "text", nameAR: "text", nameTR: "text" });

module.exports = mongoose.model("brand", brandSchema);
