// models/journalEntry.js
// ✅ SAME TYPES AS YOU ASKED (journalDate stays String)
// ✅ Only add indexes + keep your existing hooks

const mongoose = require("mongoose");

const journalEntrySchema = new mongoose.Schema(
  {
    journalName: String,
    journalDate: String, // keep as-is (string)
    journalSerialNum: String,
    journalRefNum: String,
    journalDesc: String,
    journalDebit: Number,
    journalCredit: Number,
    journalAccounts: [
      {
        counter: Number,
        id: String,
        name: String,
        accountDebit: Number,
        accountCredit: Number,
        MainDebit: Number,
        MainCredit: Number,
        accountCurrency: String,
        isPrimary: Boolean,
        accountExRate: Number,
        Desc: String,
        accountType: String,
        code: String,
        party: String,
        partyName: String,
        _id: false,
      },
    ],
    journalType: String,
    counter: String,
    linkCounter: String,
    refCounter: String,
    filesArray: [String],
    sync: { type: Boolean, default: false },
    companyId: { type: String, required: true, index: true },
    party: String,
    receiptNumber: String,
    refId: String,
    auditing: { type: Boolean, default: false },
  },
  { timestamps: true }
);

/**
 * ✅ Add helpful indexes
 * - companyId is already indexed.
 * - this helps "recent" or range queries if you later migrate journalDate to Date.
 * - currently journalDate is String so Mongo can't use it for real date ranges,
 *   but this still helps if you do equality / prefix / sorting sometimes.
 */
journalEntrySchema.index({ companyId: 1, journalDate: 1 });

const setfilesURL = (doc) => {
  if (doc.filesArray && Array.isArray(doc.filesArray)) {
    doc.filesArray = doc.filesArray.map(
      (file) => `${process.env.BASE_URL}/journal/${file.fileName || file}`
    );
  }
};

journalEntrySchema.post("save", function (doc) {
  setfilesURL(doc);
});

journalEntrySchema.post("init", function (doc) {
  setfilesURL(doc);
});

module.exports = mongoose.model("journalEntry", journalEntrySchema);
