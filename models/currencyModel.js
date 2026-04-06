const mongoose = require("mongoose");

const currencySchema = new mongoose.Schema(
  {
    currencyCode: {
      type: String,
      required: [true, "Currency code is required"],
      trim: true,
    },
    currencyName: {
      type: String,
      required: [true, "Currency name is required"],
      trim: true,
    },
    exchangeRate: {
      type: Number,
      default: 1,
      min: 0.000001,
    },
    buyingExchangeRate: {
      type: Number,
      default: 1,
      min: 0.000001,
    },
    sellingExchangeRate: {
      type: Number,
      default: 1,
      min: 0.000001,
    },
    is_primary: {
      type: Boolean,
      default: false,
    },

    thousandSeparator: {
      type: String,
      default: ",",
    },
    decimalSeparator: {
      type: String,
      default: ".",
    },
    decimals: {
      type: Number,
      default: 2,
    },

    sync: {
      type: Boolean,
      default: false,
    },

    companyId: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

currencySchema.index(
  { companyId: 1, is_primary: 1 },
  {
    unique: true,
    partialFilterExpression: { is_primary: true },
  },
);

module.exports = mongoose.model("Currency", currencySchema);
