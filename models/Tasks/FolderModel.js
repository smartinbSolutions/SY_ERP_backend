const mongoose = require("mongoose");

const folderSchema = new mongoose.Schema(
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

    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "staff",
      required: true,
    },

    visibility: {
      type: String,
      enum: ["public", "private"],
      default: "private",
      index: true,
    },

    members: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "staff",
          required: true,
        },

        role: {
          type: String,
          enum: ["owner", "manager", "member", "viewer"],
          default: "viewer",
        },

        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

folderSchema.index({ "members.user": 1 });
folderSchema.index({ workspace: 1, companyId: 1 });

module.exports = mongoose.model("Folder", folderSchema);
