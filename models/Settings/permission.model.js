const mongoose = require("mongoose");

const permissionSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    group: {
      type: String,
      trim: true,
    },

    module: {
      type: String,
      enum: [
        "inventory",
        "accounting",
        "hr",
        "reports",
        "settings",
        "pos",
        "statistics",
        "general",
        "ecommerce",
        "maintenance",
        "restaurant",
      ],
      required: true,
      lowercase: true,
      index: true,
    },
  },
  { timestamps: true },
);

permissionSchema.index({ module: 1 });
permissionSchema.index({ group: 1 });

module.exports = mongoose.model("Permission", permissionSchema);
