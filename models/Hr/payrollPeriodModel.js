const mongoose = require("mongoose");

const payrollPeriodSchema = new mongoose.Schema(
  {
    payrollGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PayrollGroup",
      required: true,
    },

    companyId: {
      type: String,
      required: true,
      index: true,
    },

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: ["open", "closed", "processing"],
      default: "open",
    },

    notes: {
      type: String,
      trim: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "staff",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("PayrollPeriod", payrollPeriodSchema);
