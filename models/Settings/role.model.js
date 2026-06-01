const mongoose = require("mongoose");

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Role name is required"],
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    // 🔐 Where this role can operate
    channels: {
      type: [String],
      enum: ["dashboard", "pos"],
      default: ["dashboard"],
    },

    // 🔑 Permission references
    permissions: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "Permission",
      },
    ],

    // Company scope (multi-tenant)
    companyId: {
      type: String,
      required: true,
      index: true,
    },

    // Soft control
    active: {
      type: Boolean,
      default: true,
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true },
);

// Prevent duplicate role names per company
roleSchema.index({ companyId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Role", roleSchema);
