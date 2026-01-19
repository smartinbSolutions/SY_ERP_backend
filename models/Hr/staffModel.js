const mongoose = require("mongoose");

const StaffSchema = new mongoose.Schema(
  {
    /* ================= BASIC INFO ================= */
    name: {
      type: String,
      trim: true,
    },

    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
    },

    latinName: String,
    phoneNumber: String,
    salary: Number,

    /* ================= IMAGES ================= */
    profileImage: String,

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

    currency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Currency",
    },

    dateSalaryDue: String,

    employmentStatus: {
      type: Boolean,
      default: true,
    },

    /* ================= TAGS ================= */
    tags: [
      {
        id: String,
        name: String,
        color: String,
        _id: false,
      },
    ],

    /* ================= STAFF FILES ================= */
    files: [
      {
        fileId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Files",
          required: true,
        },

        fileUrl: {
          type: String,
          required: true,
        },

        expiryDate: {
          type: Date,
        },
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
