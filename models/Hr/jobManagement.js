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
    skills: [String],
    companyInfo: {
      name: String,
      logo: String,
      location: String,
      email: String,
    },
    companyId: String,
  },
  { timestamps: true }
);

const setImageURL = (doc) => {
  if (doc.companyInfo && doc.companyInfo.logo) {
    const imageUrl = `${process.env.BASE_URL}/jobManagement/${doc.companyInfo.logo}`;
    doc.companyInfo.logo = imageUrl;
  }
};

jobSchema.post("init", function (doc) {
  setImageURL(doc);
});

jobSchema.post("save", (doc) => {
  setImageURL(doc);
});

module.exports = mongoose.model("jobs", jobSchema);
