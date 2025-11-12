const mongoose = require("mongoose");

const AccountingTreeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    nameAr: { type: String, default: "" },
    nameTr: { type: String, default: "" },
    code: { type: String, required: true },
    depreciationAccount: String,
    accountType: { type: String },
    detailType: String,
    description: String,
    date: String,
    parentId: { type: String, default: null },
    parentCode: {
      type: String,
      default: null,
    },
    accountCategory: {
      type: String,
    },
    currency: {
      type: mongoose.Schema.ObjectId,
      ref: "Currency",
    },
    creditor: { type: Number, default: 0 },
    debtor: { type: Number, default: 0 },
    balanceType: { type: String, default: "debit" },
    sync: { type: Boolean, default: false },
    companyId: {
      type: String,
      required: true,
      index: true,
    },
    finalAccount: String,
  },
  { timestamps: true }
);

AccountingTreeSchema.index({ code: 1, companyId: 1 }, { unique: true });
AccountingTreeSchema.index({ parentId: 1 });
AccountingTreeSchema.index({ accountType: 1 });
AccountingTreeSchema.index({ currency: 1 });

module.exports = mongoose.model("AccountingTree", AccountingTreeSchema);
