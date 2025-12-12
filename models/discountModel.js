const mongoose = require("mongoose");

const DiscountSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["product", "category", "brand", "cart", "coupon"],
      required: true,
    },

    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      required: true,
    },

    value: { type: Number, required: true },

    products: [{ type: mongoose.Schema.Types.ObjectId, ref: "product" }],

    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],

    brands: [{ type: mongoose.Schema.Types.ObjectId, ref: "brand" }],

    couponCode: {
      type: String,
      index: true,
      sparse: true,
    },
    minPurchase: Number,

    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    isActive: { type: Boolean, default: true },

    companyId: {
      type: String,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Discount", DiscountSchema);
