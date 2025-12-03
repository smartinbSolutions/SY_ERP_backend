const mongoose = require("mongoose");

const branchesSchema = new mongoose.Schema(
  {
    name: String,
    location: String,
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
