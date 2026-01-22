const mongoose = require("mongoose");

const leavesSchema = new mongoose.Schema(
  {
    name: String,
    code: String,
    isPaid: Boolean,
    deduction: Number,
    attachment: Boolean,
    notes: String,
    companyId: {
      type: String,
      required: true, 
      index: true,
    },
  },

  { timestamps: true }
);

module.exports = mongoose.model("leaves", leavesSchema);
