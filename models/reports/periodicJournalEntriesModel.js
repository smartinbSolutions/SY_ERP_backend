const mongoose = require("mongoose");

const periodicJournalEntriesModel = new mongoose.Schema(
  {
    name: String,
    year: String,

    yearTotal: Number,
    months: [
      {
        month: {
          type: String,
        },
        amount: {
          type: Number,
          default: 0,
        },
        _id: false,
      },
    ],

    accountId: String,
    parentId: String,
    parentCode: String,
    code: String,
    companyId: {
      type: String,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "PeriodicJournalEntries",
  periodicJournalEntriesModel
);
