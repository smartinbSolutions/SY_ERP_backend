const mongoose = require("mongoose");

const journalEntrySchema = new mongoose.Schema(
  {
    journalName: String,

    journalDate: {
      type: Date,
      required: true,
    },
    journalSerialNum: String,
    journalRefNum: String,
    journalDesc: String,

    journalDebit: {
      type: Number,
      default: 0,
    },
    journalCredit: {
      type: Number,
      default: 0,
    },

    journalAccounts: [
      {
        counter: Number,

        accountId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "AccountingTree",
        },

        name: String,
        code: String,
        accountType: String,

        accountDebit: Number,
        accountCredit: Number,

        MainDebit: Number,
        MainCredit: Number,

        accountCurrency: String,
        accountExRate: Number,

        isPrimary: Boolean,

        Desc: String,
        _id: false,
      },
    ],

    journalType: String,

    counter: String,
    linkCounter: String,
    refCounter: String,

    filesArray: [String],

    companyId: {
      type: String,
      required: true,
      index: true,
    },

    party: String,
    receiptNumber: String,
    refId: String,

    auditing: {
      type: Boolean,
      default: false,
    },
    status: { type: String, enum: ["active", "reversed"], default: "active" },

    reversedAt: { type: Date, default: null },
    reverseJournalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Journal",
      default: null,
    },
  },
  { timestamps: true },
);

journalEntrySchema.index({ companyId: 1, createdAt: -1 });
journalEntrySchema.index({ companyId: 1, journalDateISO: 1 });

const setfilesURL = (doc) => {
  if (doc.filesArray && Array.isArray(doc.filesArray)) {
    doc.filesArray = doc.filesArray.map(
      (file) => `${process.env.BASE_URL}/journal/${file.fileName || file}`,
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
