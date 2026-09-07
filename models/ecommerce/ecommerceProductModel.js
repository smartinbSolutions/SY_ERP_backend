const mongoose = require("mongoose");

const ecommerceProductModel = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.ObjectId, ref: "product" },
    name: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      lowercase: true,
      trim: true,
    },
    latinName: String,

    description: {
      type: String,
      default: "Product description",
    },
    latinDescription: String,
    shortDescription: {
      type: String,
      default: "Product short description",
    },

    specifications: [
      {
        key: {
          type: String,
          required: true,
          trim: true,
        },
        value: {
          type: String,
          required: true,
          trim: true,
        },
        _id: false,
      },
    ],
    latinShortDescription: String,
    imageCover: {
      type: String,
      default: null,
    },
    ecommercePrice: {
      type: Number,
      default: 0,
    },
    ecommercePriceMainCurrency: {
      type: Number,
      default: 0,
    },
    ecommercePriceBeforeTax: {
      type: Number,
      default: 0,
    },
    ecommercePriceAftereDiscount: {
      type: Number,
      default: 0,
    },
    imagesArray: [
      {
        image: String,
        _id: false,
      },
    ],
    ratingsAverage: {
      type: Number,
      default: 0,
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
    addToCart: { type: Number, default: 0 },
    addToFavourites: { type: Number, default: 0 },
    ecommerceActive: { type: Boolean, default: false },
    publish: { type: Boolean, default: false },
    featured: { type: Boolean, default: false },
    sponsored: { type: Boolean, default: false },
    height: {
      type: Number,
      default: 0,
    },
    width: {
      type: Number,
      default: 0,
    },
    weight: {
      type: Number,
      default: 0,
    },
    length: {
      type: Number,
      default: 0,
    },
    density: String,

    shippingCompany: {
      type: mongoose.Schema.ObjectId,
      ref: "ShippingCompany",
    },
    alternateProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "product",
        _id: false,
      },
    ],
    importDate: {
      type: Date,
      default: Date.now,
    },
    companyId: {
      type: String,
      required: true,
      index: true,
    },
    productNo: { type: Number, default: 0 },
    metas: {
      title: { type: String, default: "" },
      latinTitle: { type: String, default: "" },

      description: { type: String, default: "" },
      latinDescription: { type: String, default: "" },
    },
    keywords: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

// Pre-save hook to assign productNo
ecommerceProductModel.pre("save", async function (next) {
  if (!this.productNo) {
    try {
      const lastProduct = await this.constructor
        .findOne({ companyId: this.companyId }, { productNo: 1 })
        .sort({ productNo: -1 });

      this.productNo = lastProduct ? lastProduct.productNo + 1 : 1;
    } catch (err) {
      return next(err);
    }
  }
  next();
});

ecommerceProductModel.virtual("review", {
  ref: "Review",
  foreignField: "product",
  localField: "_id",
});

module.exports = mongoose.model("ecommerceProduct", ecommerceProductModel);
