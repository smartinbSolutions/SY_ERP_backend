const mongoose = require("mongoose");

const DepartmentSchema = new mongoose.Schema(
  {
    name: String,
    nameAR: String,
    nameTR: String,
    code: String,
    // branchId: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "Branch",
    //   default: null,
    // },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    description: String,
    companyId: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("departments", DepartmentSchema);
