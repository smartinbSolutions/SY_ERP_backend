const { default: mongoose } = require("mongoose");

const StaffSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  email: {
    type: String,
    unique: true,
  },
  latinName: String,
  phoneNumber: String,
  salary: Number,
  profileImage: String, 
  position: { type: mongoose.Schema.ObjectId, ref: "Positions" },
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Groups",
  },
  isUser: Boolean,
  directManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "staff",
  },
  department: { type: mongoose.Schema.ObjectId, ref: "departments" },
  hireDate: String,
  currency: { type: mongoose.Schema.ObjectId, ref: "Currency" },
  dateSalaryDue: String,
  password: String,
  employmentStatus: { type: Boolean, default: true },
  tags: [
    {
      id: String,
      name: String,
      color: String,
      _id: false,
    },
  ],
  files: [String],
  companyId: {
    type: String,
    required: true,
    index: true,
  },
  session: { type: Boolean, default: false },
});
const setFileURLs = (doc) => {
  if (doc.profileImage) {
    doc.profileImage = `${process.env.BASE_URL}/profileImage/${doc.profileImage}`;
  }

  if (Array.isArray(doc.files)) {
    doc.files = doc.files.map((file) =>
      file.startsWith("http") ? file : `${process.env.BASE_URL}/hrDocs/${file}`
    );
  }
};

StaffSchema.post("init", function (doc) {
  setFileURLs(doc);
});

//Create
StaffSchema.post("save", (doc) => {
  setFileURLs(doc);
});

module.exports = mongoose.model("staff", StaffSchema);
