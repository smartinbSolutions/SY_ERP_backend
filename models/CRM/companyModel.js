const mongoose = require("mongoose");

const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    industry: { type: String, trim: true },
    website: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
    },
    annualRevenue: { type: Number, min: 0 }, //
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tags: [String],
    customFields: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
    notes: { type: String, maxlength: 2000 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);



module.exports = mongoose.model("Company", companySchema);
