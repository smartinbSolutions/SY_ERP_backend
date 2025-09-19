const { default: mongoose } = require("mongoose");

const ClosingReportSchema = new mongoose.Schema(
  {
    companyId: { type: String },
    startDate: String,
    endDate: String,
    incomeStatement: Object,
    balanceSheet: Object,
  },
  { timestamps: true }
);

module.exports = mongoose.model("ClosingReport", ClosingReportSchema);
