const mongoose = require("mongoose");

const investorSchema = new mongoose.Schema(
  {
    fullName: String,
    latinName: String,
    slug: { type: String, lowercase: true },
    phoneNumber: String,
    email: String,
    password: String,
    birthDate: String,
    ibanNumbers: [
      {
        bankName: String,
        iban: String,
      },
    ],
    attachments: {
      type: [
        {
          key: { type: String, required: true },
          fileUrl: { type: String, required: true },
        },
      ],
      default: [],
      _id: false,
    },
    profileImage: String,
    deletable: { type: Boolean, default: true },
    isFounder: { type: Boolean, default: false },
    ownedShares: { type: Number, default: 0 },
    companyId: String,
    active: { type: Boolean, default: true },
    activeSessionId: { type: String, default: null },
    sessionStartedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
const setImageURL = (doc) => {
  if (doc.passportImage) {
    doc.passportImage = `${process.env.BASE_URL}/Investor/${doc.passportImage}`;
  }
  if (doc.idCardImage) {
    doc.idCardImage = `${process.env.BASE_URL}/Investor/${doc.idCardImage}`;
  }
  if (doc.profileImage) {
    doc.profileImage = `${process.env.BASE_URL}/Investor/${doc.profileImage}`;
  }
};
// findOne, findAll and update
// investorSchema.post("init", (doc) => {
//   setImageURL(doc);
// });

// create
investorSchema.post("save", (doc) => {
  setImageURL(doc);
});

module.exports = mongoose.model("investors", investorSchema);
