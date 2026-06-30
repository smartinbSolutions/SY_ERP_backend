const mongoose = require("mongoose");

const filesSchema = new mongoose.Schema(
  {
    name: String,
    hasExpiry: { type: Boolean, default: false },
    required: Boolean,
    expiryMonths: Number,
    companyId: {
      type: String,
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Files", filesSchema);
