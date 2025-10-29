const mongoose = require("mongoose");

const budgetSchema = new mongoose.Schema(
  {
    date: String,
    companyId: String,
    employee: String,
    name: String,
    status: { type: String, default: "Draft" },
    budgetType: { type: String, default: "Months" },
    account: [
      {
        name: String,
        accountType: String,
        amount: Number,
        balanceType: { type: String, enum: ["debit", "credit"] },
        accountId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "AccountingTree",
        },
        monthly: {
          jan: { type: Number, default: 0 },
          feb: { type: Number, default: 0 },
          mar: { type: Number, default: 0 },
          apr: { type: Number, default: 0 },
          may: { type: Number, default: 0 },
          jun: { type: Number, default: 0 },
          jul: { type: Number, default: 0 },
          aug: { type: Number, default: 0 },
          sep: { type: Number, default: 0 },
          oct: { type: Number, default: 0 },
          nov: { type: Number, default: 0 },
          dec: { type: Number, default: 0 },
        },
        yearly: {
          type: Map,
          of: Number,
          default: {},
        },
        parentId: String,
        parentCode: String,

        total: { type: Number, default: 0 },
        _id: false,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("budget", budgetSchema);
