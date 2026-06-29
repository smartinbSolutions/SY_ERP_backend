const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const companyInfoSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: true,
      minlength: [3, "Name is too short"],
      trim: true,
    },
    publicId: { type: String, default: uuidv4, unique: true, index: true },
    companyAddress: String,
    companyTax: String,

    companyEmail: {
      type: String,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email"],
    },
    companyTel: String,

    companyLogo: {
      type: String,
      default: "defaultLogo.png",
    },

    rollOver: {
      type: Boolean,
      default: false,
    },
    closedAt: Date,

    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "companyinfo",
    },
    jobsCompanyId: { type: String, default: "" },

    currentSubscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      index: true,
    },
  },
  { timestamps: true },
);

const setImageURL = (doc) => {
  if (
    doc.companyLogo &&
    process.env.BASE_URL &&
    !doc.companyLogo.startsWith("http")
  ) {
    doc.companyLogo = `${process.env.BASE_URL}/companyinfo/${doc.companyLogo}`;
  }
};

companyInfoSchema.post("init", function (docs) {
  setImageURL(docs);
});

//Create
companyInfoSchema.post("save", (doc) => {
  setImageURL(doc);
});

module.exports = mongoose.model("companyinfo", companyInfoSchema);
