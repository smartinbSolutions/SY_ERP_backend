const mongoose = require("mongoose");

const StaffSchema = new mongoose.Schema(
  {
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
      type: String,
    },

    nationality: String,
    maritalStatus: String,

    disabilitiesOrHealthConditions: {
      type: String,
      default: "",
    },

    profileImage: String,

    canCreateWorkspace: {
      type: Boolean,
      default: false,
    },

    city: String,
    homeAddress: String,

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

    payrollGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PayrollGroup",
    },

    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Roles",
    },

    isUser: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
    },
    password: String,
    passwordResetCode: String,
    passwordResetExpires: Date,
    resetCodeVerified: {
      type: Boolean,
      default: false,
    },

    directManager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "staff",
    },

    hireDate: Date,

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

    salary: {
      amount: Number,

      payType: {
        type: String,
        enum: ["hourly", "weekly", "biweekly", "monthly"],
        default: "monthly",
      },

      hourlyRate: Number,
      lastRateCalculatedAt: Date,
    },

    currency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Currency",
    },

    dateSalaryDue: Number,

    emergencyContact: {
      name: String,
      phone: String,
    },

    tags: [String],

    bankDetails: {
      bankName: String,
      accountName: String,
      accountNumber: String,
      swiftBicCode: String,
      iban: String,
    },

    education: {
      highestLevel: String,
      degreeMajor: String,
      institution: String,
      graduationYear: Number,
      licenseNumbers: [String],
    },

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
  { timestamps: true },
);

const setProfileImageURL = (doc) => {
  if (doc.profileImage) {
    doc.profileImage = doc.profileImage.startsWith("http")
      ? doc.profileImage
      : `${process.env.BASE_URL}/profileImage/${doc.profileImage}`;
  }
};

StaffSchema.post("init", function (doc) {
  setProfileImageURL(doc);
});

StaffSchema.post("save", function (doc) {
  setProfileImageURL(doc);
});

module.exports = mongoose.model("staff", StaffSchema);
