const mongoose = require("mongoose");

const reconciliationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },

    reconcilingDate: { type: String, required: true },

    stockId: { type: String, required: true },
    stockName: { type: String },

    employee: { type: String },

    status: {
      type: String,
      enum: ["DRAFT", "SUBMITTING", "CLOSED"],
      default: "DRAFT",
      index: true,
    },

    journalCounter: String,
    financialLossLink: String,

    sync: { type: Boolean, default: false },

    companyId: { type: String, required: true, index: true },

    createdBy: { type: String },
    counter: String,
  },
  { timestamps: true }
);
reconciliationSchema.index(
  { companyId: 1, stockId: 1, reconciliationType: 1 },
  {
    unique: true,
    partialFilterExpression: {
      reconciliationType: "FIRST_TIME",
    },
  }
);

module.exports = mongoose.model("Reconciliation-v1", reconciliationSchema);
