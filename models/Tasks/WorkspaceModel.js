const mongoose = require("mongoose");

const workspaceSchema = new mongoose.Schema(
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

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "staff",
      required: true,
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
          default: "member",
        },
        status: {
          type: String,
          enum: ["active", "invited"],
          default: "active",
        },

        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true },
);

workspaceSchema.index({ "members.user": 1 });

module.exports = mongoose.model("Workspace", workspaceSchema);
