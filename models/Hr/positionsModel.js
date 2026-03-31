const mongoose = require("mongoose");

const positionsSchema = new mongoose.Schema(
  {
    name: String,
    AlternativeName: String,
    description: String,
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "departments",
    },
    // jobgradeId: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "jobgrades",
    //   required: true,
    // },
    parentPositions: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Positions",
      default: null,
    },
    salary: {
      min: String,
      max: String,
    },
    // children: [{ type: mongoose.Schema.Types.ObjectId, ref: "Positions" }],
    sync: { type: Boolean, default: false },
    companyId: {
      type: String,
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Positions", positionsSchema);
