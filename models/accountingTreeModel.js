const mongoose = require("mongoose");

const AccountingTreeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    nameAr: { type: String, default: "", trim: true },
    nameTr: { type: String, default: "", trim: true },

    code: {
      type: String,
      required: true,
      trim: true,
    },

    depreciationAccount: String,
    accountType: { type: String },
    detailType: String,
    description: String,

    date: String, // keep as-is (you use it elsewhere)

    parentId: { type: String, default: null },

    parentCode: {
      type: String,
      default: null,
    },

    accountCategory: { type: String },

    currency: {
      type: mongoose.Schema.ObjectId,
      ref: "Currency",
    },

    creditor: { type: Number, default: 0 },
    debtor: { type: Number, default: 0 },

    balanceType: {
      type: String,
      enum: ["debit", "credit", "debit/credit"],
      default: "debit",
    },

    sync: { type: Boolean, default: false },

    companyId: {
      type: String,
      required: true,
    },

    finalAccount: String,
    originalAccountId: String,
  },
  { timestamps: true }
);

/* =============================================
   🔥 CRITICAL INDEXES (VERY IMPORTANT)
============================================= */

// Ensures unique code per company
AccountingTreeSchema.index({ companyId: 1, code: 1 }, { unique: true });

// Needed for fast tree building
AccountingTreeSchema.index({ companyId: 1, parentCode: 1 });

// Needed for quick root fetch
AccountingTreeSchema.index({ companyId: 1, parentId: 1 });

// Needed for account type filters
AccountingTreeSchema.index({ companyId: 1, accountType: 1 });

// Currency-based reporting
AccountingTreeSchema.index({ companyId: 1, currency: 1 });

// Optional but useful if you sort by code
AccountingTreeSchema.index({ companyId: 1, code: 1 });

module.exports = mongoose.model("AccountingTree", AccountingTreeSchema);
