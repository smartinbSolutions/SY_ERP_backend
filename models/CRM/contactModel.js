const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    jobTitle: { type: String, trim: true },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: { type: String, enum: ["active", "inactive"], default: "active" }, //active or inactive contact
    source: {
      type: String,
      enum: ["website", "referral", "ads", "cold_call", "event", "other"],
      default: "other",
    }, //from where the contact was acquired
    tags: [String],
    notes: { type: String },
    isPrimary: { type: Boolean, default: false }, //maincontact for the company
  },
  { timestamps: true },
);

module.exports = mongoose.model("Contact", contactSchema);
