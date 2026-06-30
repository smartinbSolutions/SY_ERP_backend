const mongoose = require("mongoose");

const jobGradesSchema = new mongoose.Schema(
  {
    name: String,
    AlternativeName: String,
    description: String,
    levelNumber: String,
    companyId: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("jobgrades", jobGradesSchema);
