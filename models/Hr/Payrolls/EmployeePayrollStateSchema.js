const mongoose = require("mongoose");

const EmployeePayrollStateSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
      index: true,
    },

    payrollPeriodId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PayrollPeriod",
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["pending", "processing", "calculated", "failed", "skipped"],
      default: "pending",
      index: true,
    },

    step: {
      type: String,
      enum: [
        "none",
        "attendance",
        "leaves",
        "overtime",
        "advances",
        "deductions",
        "done",
      ],
      default: "none",
    },

    errorMessage: String,

    retryCount: { type: Number, default: 0 },

    startedAt: Date,
    finishedAt: Date,
    lastUpdatedAt: Date,
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model(
  "EmployeePayrollState",
  EmployeePayrollStateSchema,
);
