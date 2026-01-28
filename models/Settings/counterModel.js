const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    seq: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

counterSchema.index({ companyId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Counter", counterSchema);
