const mongoose = require("mongoose");

const companyIfnoSchema = new mongoose.Schema({
  companyName: {
    type: String,
    minlength: [3, "Name is too short"],
  },
  companyAddress: String,
  companyTax: String,
  companyEmail: String,
  companyTel: String,
  turkcellApiKey: String,
  companyLogo: {
    type: String,
    default: `defaultLogo.png`,
  },
  pinCode: { type: Number, default: 1234 },
  color: [String],
  havePin: {
    type: Boolean,
    enum: ["true", "false"],
    default: "false",
  },
  emails: { support: String, ecommerce: String, accounting: String },
  xtwitterUrl: String,
  linkedinUrl: String,
  instagramUrl: String,
  facebookUrl: String,
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
});

const setImageURL = (doc) => {
  if (doc.companyLogo) {
    const imageUrl = `${process.env.BASE_URL}/companyinfo/${doc.companyLogo}`;
    doc.companyLogo = imageUrl;
  }
};

companyIfnoSchema.post("init", function (docs) {
  setImageURL(docs);
});

//Create
companyIfnoSchema.post("save", (doc) => {
  setImageURL(doc);
});

module.exports = mongoose.model("companyinfo", companyIfnoSchema);
