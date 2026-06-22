const mongoose = require("mongoose");

const companySubSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "companyinfo",
      required: true,
      index: true,
    },

    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },

    // Optional POS restriction (empty = access to all POS in company)
    allowedPOSPoints: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "POSPoint",
      },
    ],

    authMethods: {
      passwordEnabled: {
        type: Boolean,
        default: true,
      },
      pinEnabled: {
        type: Boolean,
        default: false,
      },
    },

    pinHash: {
      type: String,
      select: false,
    },

    active: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "user name is required"],
      trim: true,
    },

    phone: Number,

    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      unique: true,
      index: true,
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [4, "Password must be at least 4 characters long"],
      select: false,
    },

    passwordChangedAt: Date,
    passwordResetCode: { type: String },
    passwordResetExpires: { type: Date },
    passwordResetVerified: { type: Boolean },

    image: String,
    AdditionalInfo: String,

    companies: [companySubSchema],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Prevent duplicate company per user
userSchema.index({ email: 1, "companies.companyId": 1 }, { unique: true });

// Attach image URL safely
userSchema.post("init", attachImageURL);
userSchema.post("save", attachImageURL);

function attachImageURL(doc) {
  if (doc.image && !doc.image.startsWith("http")) {
    doc.image = `${process.env.BASE_URL}/Image/${doc.image}`;
  }
}

module.exports = mongoose.model("user", userSchema);
