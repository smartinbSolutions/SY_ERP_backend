const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      require: true,
    },

    latinName: String,
    slug: {
      type: String,
      lowercase: true,
    },
    type: {
      type: String,
      default: "Normal",
    },

    description: {
      type: String,
      default: "Product description",
    },

    sold: {
      type: Number,
      default: 0,
    },
    quantity: { type: Number, default: 0 },
    price: {
      type: Number,
      default: 0,
    },

    buyingprice: {
      type: Number,
      default: 0,
    },

    qr: [
      {
        type: String,
        minlength: [3, "Too short QR code"],
        maxlength: [30, "Too long QR code"],
        index: true,
        require: true,
      },
    ],
    sku: {
      type: String,
      default: 0,
    },
    image: {
      type: String,
    },

    brand: {
      type: mongoose.Schema.ObjectId,
      ref: "brand",
    },
    category: {
      type: mongoose.Schema.ObjectId,
      ref: "Category",
    },
    unit: {
      type: mongoose.Schema.ObjectId,
      ref: "Unit",
    },
    alarm: { type: Number, default: 0 },
    tax: {
      type: mongoose.Schema.ObjectId,
      ref: "Tax",
    },
    label: {
      type: mongoose.Schema.ObjectId,
      ref: "Labels",
    },
    archives: {
      type: String,
      enum: ["true", "false"],
      default: "false",
    },
    currency: {
      type: mongoose.Schema.ObjectId,
      ref: "Currency",
    },
    profitRatio: { type: Number, default: 5 },
    AdditionalInfo: {
      type: String,
      default: "Additional Info",
    },
    mostLiklySupplier: {
      type: mongoose.Schema.ObjectId,
      ref: "Supplier",
      default: null,
    },
    customAttributes: [
      {
        key: String,
        value: String,
        _id: false,
      },
    ],
    serialNumbers: [{ type: String, default: "" }],
    expirationDate: { type: String, default: Date.now },
    unitsPrices: [
      {
        name: String,
        equal: String,
        unitId: {
          type: mongoose.Schema.ObjectId,
          ref: "Unit",
        },
        prices: [
          {
            title: String,
            price: Number,
            _id: false,
          },
        ],
        _id: false,
      },
    ],
    addToCart: { type: Number, default: 0 },
    addToFavourites: { type: Number, default: 0 },
    stocks: [
      {
        stockId: String,
        stockName: String,
        productQuantity: Number,
        minimum: String,
        maximum: String,
        _id: false,
      },
    ],

    groupID: { type: String },

    soldByMonth: Number,
    soldByWeek: Number,
    haveGift: Boolean,
    soldToWinGift: Number,
    haveCost: { type: Boolean, default: true },

    sync: { type: Boolean, default: false },
    companyId: {
      type: String,
      required: true,
      index: true,
    },
    variantName: [{ name: String, values: [String] }],
    variants: [
      {
        name: { type: String },
        qr: { type: String },
        buyingprice: { type: Number },
        price: { type: Number },
        taxValue: { type: Number, default: 0 },
        priceTax: { type: Number, default: 0 },
        profitRatio: { type: Number, default: 0 },
        available: { type: Boolean, default: true },
        stocks: [
          {
            stockId: { type: String },
            stockName: { type: String },
            quantity: { type: Number, default: 0 },
            _id: false,
          },
        ],
        _id: false,
      },
    ],
    counter: String,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// const setImageURL = (doc) => {
//   if (doc.image) {
//     const imageUrl = `${process.env.BASE_URL}/product/${doc.image}`;
//     doc.image = imageUrl;
//   }

//   if (doc.imagesArray) {
//     const imageList = doc.imagesArray.map(
//       (image) => `${process.env.BASE_URL}/product/${image.image}`
//     );
//     doc.imagesArray = imageList;
//   }
// };

// productSchema.post("save", (doc) => {
//   setImageURL(doc);
// });

// productSchema.post("find", function (docs) {
//   docs.forEach(setImageURL);
// });
productSchema.index({ counter: 1, companyId: 1 }, { unique: true });

module.exports = mongoose.model("product", productSchema);
