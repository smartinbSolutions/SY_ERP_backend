const mongoose = require("mongoose");

const OpeningInventoryItemSchema = new mongoose.Schema(
  {
    openingInventoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OpeningInventory",
      required: true,
      index: true,
    },

    companyId: {
      type: String,
      required: true,
      index: true,
    },

    productId: String,
    sku: String,
    barcode: String,
    name: String,

    unit: String,

    stock: {
      id: String,
      name: String,
    },

    quantity: {
      type: Number,
      required: true,
    },

    buyingPrice: {
      type: Number,
      required: true,
    },

    total: {
      type: Number,
      required: true,
    },

    profitRatio: Number,

    note: String,
  },
  { timestamps: true },
);

OpeningInventoryItemSchema.index({
  openingInventoryId: 1,
  productId: 1,
});

module.exports = mongoose.model(
  "OpeningInventoryItem",
  OpeningInventoryItemSchema,
);
