const mongoose = require("mongoose");

const companySettingSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "companyinfo",
      required: true,
      unique: true,
      index: true,
    },
    prefix: {
      _id: false,

      dateFormat: { type: String, default: "YYYYMMDD" },
      counterFormat: { type: Number, default: 4 },

      payment: { type: String, default: "PV" },
      assets: { type: String, default: "AS" },
      receipt: { type: String, default: "RV" },
      bankDeposit: { type: String, default: "BD" },
      bankAndCashTransfer: { type: String, default: "TF" },
      journal: { type: String, default: "JV" },

      sales: { type: String, default: "SV" },
      purchase: { type: String, default: "SR" },

      depreciation: { type: String, default: "DP" },
      openingBalance: { type: String, default: "OB" },

      salesRefund: { type: String, default: "CN" },
      purchaseRefund: { type: String, default: "DN" },

      adjustment: { type: String, default: "AV" },
      quotation: { type: String, default: "QV" },
      expense: { type: String, default: "EV" },

      purchaseRequest: { type: String, default: "PR" },

      efatura: { type: String, default: "EF" },

      receiptPos: { type: String, default: "RP" },
      posRefund: { type: String, default: "RPF" },
    },
    emails: {
      _id: false,
      support: String,
      ecommerce: String,
      accounting: String,
    },

    xtwitterUrl: String,
    linkedinUrl: String,
    instagramUrl: String,
    facebookUrl: String,
    color: [String],
  },
  { timestamps: true },
);

module.exports = mongoose.model("companySetting", companySettingSchema);
