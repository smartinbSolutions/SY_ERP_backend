const mongoose = require("mongoose");

const countrySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameAr: { type: String, trim: true },
    nameTr: { type: String, trim: true },
    iso2: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      minlength: 2,
      maxlength: 2,
    },
    iso3: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
    },
    phoneCode: { type: String, trim: true }, // "+90"
    currency: { type: String, uppercase: true, trim: true }, // "TRY"
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

countrySchema.index({ iso2: 1 }, { unique: true });
countrySchema.index({ iso3: 1 }, { unique: true });
countrySchema.index({ name: 1 });

module.exports = mongoose.model("Country", countrySchema);
