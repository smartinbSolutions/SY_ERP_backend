const mongoose = require("mongoose");

const branchesSchema = new mongoose.Schema(
  {
    name: String,
    nameAR: String,
    nameTR: String,
    location: {
      name: String,
      latitude: {
        type: Number,
        required: true,
      },
      longitude: {
        type: Number,
        required: true,
      },
    },
    email: String,
    companyId: {
      type: String,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("branches", branchesSchema);
