const mongoose = require("mongoose");

const DepartmentSchema = new mongoose.Schema(
  {
    name: String,
    AlternativeName: String,
    code: String,
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "departments",
      default: null,
    },
    isLocal: Boolean,
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "branches",
      default: null,
    },
    description: String,
    companyId: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("departments", DepartmentSchema);