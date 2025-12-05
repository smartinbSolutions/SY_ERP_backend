const mongoose = require("mongoose");

const DepartmentSchema = new mongoose.Schema(
  {
    name: String,
    nameAR: String,
    nameTR: String,
    code: String,
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "departments",
      default: null,
    },
    description: String,
    companyId: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("departments", DepartmentSchema);
