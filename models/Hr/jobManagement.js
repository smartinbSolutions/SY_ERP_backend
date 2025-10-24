const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema(
  {
    jobTitle: String,
    type: String,
    location: String,
    description: String,
    expectedSalary: Number,
    responsibilities: [String],
    qualifications: [String],
    endDate: String,
    skills: String,
    companyId : String
  },

  { timestamps: true }
);

module.exports = mongoose.model("jobs", jobSchema);
