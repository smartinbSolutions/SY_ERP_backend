const mongoose = require("mongoose");

const jobGradesSchema = new mongoose.Schema(
  {
    name: String,
    nameAR: String,
    nameTR: String,
    description: String,
    levelNumber: String,
    salary: {
      min: String,
      max: String,
    },
    companyId: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("jobgrades", jobGradesSchema);
