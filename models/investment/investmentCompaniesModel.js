const mongoose = require("mongoose");

const investmentCompaniesSchema = new mongoose.Schema(
  {
    companyName: String,
    email: String,
    description: String,
    industry: String,
    country: String,
    valuation: Number,
    sharePrice: Number,
    totalShares: Number,
    availableShares: Number,
    currency: String,
    logo: String,
    website: String,
    status: String,
    symbol: String,
    bankQR: [
      {
        name: { type: String, default: "" },
        accountNumber: { type: String, default: "" },
        qrCode: { type: String, default: "" },
      },
    ],
    foundersArray: [
      {
        investorId: { type: mongoose.Schema.Types.ObjectId, ref: "investors" },
        shares: { type: Number, default: 0 },
        _id: false,
      },
    ],
    companyId: String,
  },
  { timestamps: true }
);

// Middleware to set image URL
const setImageURL = (doc) => {
  if (doc.logo) {
    doc.logo = `${process.env.BASE_URL}/investmentCompanies/${doc.logo}`;
  }
};

// Middleware to apply setImageURL on init and save
investmentCompaniesSchema.post("init", (doc) => {
  setImageURL(doc);
});

investmentCompaniesSchema.post("save", (doc) => {
  setImageURL(doc);
});

module.exports = mongoose.model(
  "investmentCompanies",
  investmentCompaniesSchema
);
