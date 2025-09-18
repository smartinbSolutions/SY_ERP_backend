const mongoose = require("mongoose");

const ReconciliationSchema = new mongoose.Schema(
  {
    companyId: { type: String, required: true, index: true },

    journalEntryId: {
      type: String,
    },
    accoutId: {
      type: String,
    },
    journalLineCounter: { type: String },
    desc: String,
    matchedBy: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("accountReconciliation", ReconciliationSchema);
