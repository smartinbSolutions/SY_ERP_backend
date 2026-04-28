const mongoose = require("mongoose");

const listSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    companyId: {
      type: String,
      required: true,
      index: true,
    },
    folder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Folder",
      required: true,
      index: true,
    },

    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },

    //  visibility system
    visibility: {
      type: String,
      enum: ["public", "private"],
      default: "private",
      index: true,
    },

    // members override (for private lists)
    members: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "staff",
          required: true,
        },
        role: {
          type: String,
          enum: ["viewer", "editor", "admin"],
          default: "viewer",
        },
      },
    ],

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "staff",
      required: true,
    },

    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("List", listSchema);