const mongoose = require("mongoose");

const StaffSchema = new mongoose.Schema(
  {
    /* ================= BASIC INFO ================= */
    fullName: {
      type: String,
      trim: true,
    },

    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
    },

    personalEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },

    latinName: String,
    phoneNumber: String,
    secondaryPhoneNumber: String,

    dateOfBirth: Date,

    gender: {
      String,
    },

    nationality: String,
    maritalStatus: String,

    disabilitiesOrHealthConditions: {
      type: String,
      default: "",
    },

    /* ================= IMAGES ================= */
    profileImage: String,

    /* ================= ADDRESS ================= */
    city: String,
    homeAddress: String,

    /* ================= COMPANY STRUCTURE ================= */
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "branches",
    },

    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "departments",
    },

    position: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Positions",
    },

    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Groups",
    },

    /* ================= AUTH ================= */
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Roles",
    },

    isUser: {
      type: Boolean,
      default: false,
    },

    password: String,

    /* ================= MANAGEMENT ================= */
    directManager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "staff",
    },

    /* ================= HR DATA ================= */
    hireDate: String,

    probationPeriod: String,
    probationEndDate: Date,

    contractStartDate: Date,
    contractEndDate: Date,

    terminationDate: Date,
    terminationReason: String,

    employmentStatus: {
      type: Boolean,
      default: true,
    },

    salary: Number,

    currency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Currency",
    },

    dateSalaryDue: String,

    /* ================= EMERGENCY CONTACT ================= */
    emergencyContact: {
      name: String,
      phone: String,
    },

    /* ================= TAGS ================= */
    tags: [String],

    /* ================= BANK DETAILS ================= */
    bankDetails: {
      bankName: String,
      accountName: String,
      accountNumber: String,
      swiftBicCode: String,
      iban: String,
    },

    /* ================= EDUCATION ================= */
    education: {
      highestLevel: String,
      degreeMajor: String,
      institution: String,
      graduationYear: Number,
      licenseNumbers: [String],
    },
    /* ================= CUSTOM ATTRIBUTES ================= */
    customAttributes: [
      {
        key: {
          type: String,
          trim: true,
        },
        value: {
          type: String,
          trim: true,
        },
        _id: false,
      },
    ],

    /* ================= SYSTEM ================= */
    companyId: {
      type: String,
      required: true,
      index: true,
    },

    session: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

/* ================= FILE URL FORMATTER ================= */
const setProfileImageURL = (doc) => {
  if (doc.profileImage) {
    doc.profileImage = doc.profileImage.startsWith("http")
      ? doc.profileImage
      : `${process.env.BASE_URL}/profileImage/${doc.profileImage}`;
  }
};

/* ================= STAFF HOOKS ================= */
StaffSchema.post("init", function (doc) {
  setProfileImageURL(doc);
});

StaffSchema.post("save", function (doc) {
  setProfileImageURL(doc);
});

module.exports = mongoose.model("staff", StaffSchema);
