const mongoose = require("mongoose");

const OpeningInventorySchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: true,
      index: true,
    },

    openingNumber: {
      type: String,
      index: true,
    },

    date: {
      type: String,
      required: true,
    },

    description: String,

    currency: {
      id: String,
      currencyCode: String,
      currencyName: String,
      exchangeRate: Number,
    },

    totalQuantity: Number,

    totalValue: Number,
    totalValueMainCurrency: Number,

    journalCounter: String,
    journalEntryId: String,

    isMigrated: { type: Boolean, default: false },
    sync: { type: Boolean, default: false },
    auditing: { type: Boolean, default: false },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("OpeningInventory", OpeningInventorySchema);
